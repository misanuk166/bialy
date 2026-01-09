# Persistent Storage Architecture Proposal

**Date**: January 8, 2026
**Version**: 1.0
**Status**: Approved for Implementation

---

## Executive Summary

This proposal outlines a comprehensive persistent storage architecture for Bialy that ensures reliable data persistence across sessions. The system guarantees that users can upload metrics, configure dashboards, close their browser, and return to find their complete workspace intact—with zero data loss and fast load times.

**Key Goals:**
1. **100% Reliability** - No silent failures, no missing data
2. **Fast Performance** - Dashboard loads in < 2 seconds
3. **Clear Feedback** - Users always know save status
4. **Data Integrity** - Atomic operations, consistent state
5. **Scalability** - Handles 100+ metrics per dashboard

---

## Problem Statement

### Current Issues

From `docs/BUG_REPORT_STORAGE_400_ERRORS.md`:

1. **Silent Upload Failures** - CSV files fail to upload but metrics appear in UI (in-memory only)
2. **400 Errors on Load** - Missing files cause 400 Bad Request errors
3. **Conflicting RLS Policies** - Duplicate `{public}` and `{authenticated}` policies
4. **No Verification** - No confirmation that files actually persisted
5. **Poor Error Feedback** - Users unaware when saves fail
6. **No Retry Logic** - Transient failures require manual intervention

### Impact

- Users lose work after browser refresh
- Dashboards appear to work but data doesn't persist
- No visibility into what went wrong
- Manual re-upload required for every failure
- Loss of trust in the application

---

## Current Architecture Analysis

### What's Working ✅

- Dashboard metadata persistence (PostgreSQL `dashboards` table)
- Metric metadata persistence (PostgreSQL `metrics` table)
- Configuration persistence (PostgreSQL `metric_configurations` table)
- RLS security policies (properly scoped)
- Multi-dashboard support
- Sharing capabilities

### What's Broken ❌

| Component | Issue | Impact |
|-----------|-------|--------|
| File uploads | No verification after upload | Silent failures |
| Storage service | No retry on transient errors | Network issues = data loss |
| Dashboard save | No validation before save | Corrupt state persisted |
| Error handling | Errors swallowed silently | Users unaware of problems |
| User feedback | No save status indicator | No visibility into state |

### Data Flow (Current)

```
User Action: Load Synthetic Metrics
  ↓
1. Generate synthetic data (in-memory)
  ↓
2. saveSeriesAsCSV() - Upload to Supabase Storage
  │  ├─ SUCCESS → Returns file path
  │  └─ FAILURE → Error caught, metric still added (❌ PROBLEM)
  ↓
3. Add metric to React state (appears in UI)
  ↓
4. Auto-save dashboard metadata to PostgreSQL
  │  └─ Saves metric with file_path (even if upload failed!)
  ↓
5. User refreshes browser
  ↓
6. Load dashboard → Download CSV files
  │  └─ File missing → 400 error → Show "No data available"

RESULT: Metrics appear to work but don't persist ❌
```

---

## Proposed Architecture

### Three-Layer Persistence Model

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT LAYER                       │
│                                                      │
│  • React state (in-memory)                          │
│  • Optimistic UI updates                            │
│  • Operation queue for pending saves                │
│  • Change tracking for dirty state                  │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                  SERVICE LAYER                       │
│                                                      │
│  • Transaction management (atomic operations)       │
│  • Retry logic with exponential backoff             │
│  • Upload verification (confirm file exists)        │
│  • Validation before save                           │
│  • Progress callbacks for UI feedback               │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                  STORAGE LAYER                       │
│                                                      │
│  ┌──────────────────┐    ┌──────────────────────┐  │
│  │ Supabase Storage │    │   PostgreSQL DB      │  │
│  │                  │    │                      │  │
│  │ • CSV files      │    │ • Dashboards         │  │
│  │ • User folders   │    │ • Metrics            │  │
│  │ • RLS policies   │    │ • Configurations     │  │
│  └──────────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Atomic Save Operations

**Current Flow (Broken)**:
```
1. Upload CSV → May fail silently
2. Save metric metadata → Always succeeds
Result: Metadata exists but no file → 400 errors
```

**Proposed Flow (Atomic)**:
```
1. Validate data locally
2. BEGIN transaction
3. Upload CSV to storage
   └─ If fails → ROLLBACK & throw error
4. Verify file exists in storage
   └─ If missing → Delete upload & ROLLBACK & throw error
5. Save metric metadata with file path
   └─ If fails → Delete file & ROLLBACK & throw error
6. Save configurations
   └─ If fails → Delete all & ROLLBACK & throw error
7. COMMIT transaction
8. Return success with details
```

### Key Components

#### 1. Upload Verification

**Problem**: Files upload but don't persist; no verification.

**Solution**: After upload, explicitly check file exists:

```typescript
// Upload file
const { data, error } = await supabase.storage
  .from('csv-files')
  .upload(filePath, file);

if (error) throw error;

// ✨ NEW: Verify file actually exists
const { data: listData } = await supabase.storage
  .from('csv-files')
  .list(userId, { search: fileName });

if (!listData?.length) {
  // File didn't persist - rollback
  await supabase.storage.from('csv-files').remove([filePath]);
  throw new Error('Upload verification failed');
}
```

#### 2. Retry Logic

**Problem**: Network errors cause permanent failures.

**Solution**: Exponential backoff retry:

```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;

      const delay = baseDelay * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }
}
```

#### 3. Transaction Manager

**Problem**: Partial saves corrupt data.

**Solution**: Atomic operations with rollback:

```typescript
const txn = new TransactionManager();

try {
  // Operation 1: Upload CSV
  const filePath = await txn.execute(
    () => uploadCSV(file, userId),
    () => deleteFile(filePath) // Rollback
  );

  // Operation 2: Save metric
  const metricId = await txn.execute(
    () => saveMetric({ filePath }),
    () => deleteMetric(metricId) // Rollback
  );

  await txn.commit();
} catch (error) {
  await txn.rollback(); // Undo all operations
  throw error;
}
```

#### 4. Validation

**Problem**: Invalid states saved to database.

**Solution**: Pre-save validation:

```typescript
async function validateDashboard(
  metrics: MetricConfig[]
): Promise<ValidationResult> {
  const issues = [];

  // Check all metrics have file paths
  for (const metric of metrics) {
    if (!metric.series.filePath) {
      issues.push({
        type: 'error',
        message: `Metric "${metric.series.metadata.name}" missing file path`
      });
    }
  }

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues
  };
}
```

#### 5. User Feedback

**Problem**: Users don't know save status.

**Solution**: Visual status indicator:

```typescript
<SaveStatusIndicator status={saveStatus} />

// States: idle, saving, saved, error
// Shows: spinner, checkmark, error icon
// Actions: Retry button on error
```

---

## Implementation Phases

### Phase 1: Critical Fixes (2-3 hours) ⚡

**Priority**: IMMEDIATE

**Goals**:
- Fix storage 400 errors
- Add upload verification
- Prevent silent failures

**Deliverables**:
- Updated `storageService.ts` with verification
- Enhanced error logging
- File existence checks on load

**Success Criteria**:
- Upload success rate > 99%
- All failures logged and visible
- No 400 errors on dashboard load

---

### Phase 2: Robust Persistence (1-2 days) 🏗️

**Priority**: HIGH

**Goals**:
- Add retry logic
- Implement transactions
- Atomic save operations

**Deliverables**:
- `retry.ts` utility
- `transactionManager.ts` service
- Atomic save functions

**Success Criteria**:
- Transient failures handled automatically
- No partial saves
- Rollback works correctly

---

### Phase 3: UX Enhancements (1 day) ✨

**Priority**: MEDIUM

**Goals**:
- User visibility into save status
- Progress indicators
- Unsaved changes warnings

**Deliverables**:
- `SaveStatusIndicator` component
- Upload progress display
- Browser close warning

**Success Criteria**:
- Users always know save status
- Clear feedback on success/failure
- No accidental data loss

---

### Phase 4: Advanced Features (2-3 days) 🚀

**Priority**: LOW (Post-MVP)

**Goals**:
- Storage quota management
- Data validation
- Change tracking
- Offline support (optional)

**Deliverables**:
- `quotaService.ts`
- `validationService.ts`
- `useChangeTracking` hook

**Success Criteria**:
- Quota enforced and visible
- Invalid states prevented
- Change history tracked
- Foundation for undo/redo

---

## Database Enhancements

### New Table: Audit Log

Track all changes for debugging and compliance:

```sql
CREATE TABLE dashboard_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID REFERENCES dashboards ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users,
  action TEXT NOT NULL, -- 'create', 'update', 'delete'
  changes JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_dashboard
  ON dashboard_audit_log(dashboard_id, created_at DESC);
```

### New Table: File Metadata

Track storage files for integrity:

```sql
CREATE TABLE storage_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_id UUID REFERENCES metrics ON DELETE CASCADE,
  file_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  checksum TEXT, -- SHA-256 for integrity
  upload_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_files_path ON storage_files(file_path);
```

### New Table: User Preferences

Store user-specific settings:

```sql
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users,
  auto_save_enabled BOOLEAN DEFAULT true,
  auto_save_interval INT DEFAULT 30000, -- ms
  theme TEXT DEFAULT 'light',
  default_permission_level TEXT DEFAULT 'private',
  preferences JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Performance Targets

| **Metric** | **Current** | **Target** | **Measurement** |
|------------|-------------|------------|-----------------|
| Upload success rate | ~60% | 99.9% | Production logs |
| Save operation time | N/A | < 2s | Client-side timing |
| Dashboard load (100 metrics) | Fails | < 2s | Page load time |
| Silent failures | Common | Zero | Error tracking |
| User confidence | Low | High | User feedback |

---

## Risk Assessment

| **Risk** | **Probability** | **Impact** | **Mitigation** |
|----------|----------------|-----------|----------------|
| RLS policies still blocking | Medium | High | Test in staging first |
| Rollback leaves orphaned files | Low | Medium | Background cleanup job |
| Large file timeouts | Low | Low | Chunked uploads |
| Concurrent save conflicts | Medium | Medium | Optimistic locking |
| Storage quota exceeded | Low | Low | Pre-upload checks |

---

## Success Metrics

### Technical Metrics

- ✅ Upload reliability > 99%
- ✅ Save time < 2 seconds
- ✅ Load time < 2 seconds
- ✅ Zero silent failures
- ✅ Error rate < 0.1%

### User Experience Metrics

- ✅ Save status always visible
- ✅ Clear error messages
- ✅ Automatic retry on transient failures
- ✅ No data loss on refresh
- ✅ Warning before losing unsaved work

---

## Testing Strategy

### Unit Tests

- `uploadCSVFile()` - Mock Supabase, test success/failure
- `retryWithBackoff()` - Test exponential delays
- `TransactionManager.rollback()` - Verify all operations reversed

### Integration Tests

- Upload → Verify → Save → Load cycle
- Upload failure → Rollback → No orphaned data
- Concurrent saves → No race conditions

### End-to-End Tests

1. User uploads 10 metrics
2. Close browser
3. Reopen in new session
4. Verify all metrics load with data

### Load Tests

- 100 metrics in single dashboard
- 50 concurrent users saving
- 10MB CSV file uploads

---

## Rollout Plan

### Week 1: Phase 1 (Critical Fixes)

- Deploy to staging
- Test with internal users
- Deploy to production if successful

### Week 2: Phase 2 (Robust Persistence)

- Deploy behind feature flag
- Enable for 10% of users
- Monitor error rates
- Full rollout after 3 days

### Week 3: Phase 3 (UX Enhancements)

- Deploy to all users
- Collect feedback
- Iterate on UI

### Week 4: Phase 4 (Advanced Features)

- Implement quota system
- Add validation
- Deploy incrementally

---

## Open Questions

### 1. Auto-save vs Manual Save

**Question**: Should saves be automatic or require explicit user action?

**Options**:
- A) Auto-save with debouncing (current behavior)
- B) Manual save button only
- C) Manual save + auto-save fallback (recommended)

**Recommendation**: Option C - Manual button gives control, auto-save prevents data loss

### 2. Storage Limits

**Question**: What are the storage limits per user?

**Proposal**:
- 10MB per file
- 100MB total per user
- Warning at 80% usage
- Error at 100% usage

### 3. File Versioning

**Question**: Should old CSV files be kept when metric is updated?

**Recommendation**: Not for MVP, add later if users request

### 4. Backup Strategy

**Question**: How often should dashboards be backed up?

**Proposal**:
- Nightly snapshot to separate table
- Keep last 7 days
- One-click restore from backup

---

## Dependencies

### External

- Supabase Storage API (existing)
- Supabase PostgreSQL (existing)
- Vercel hosting (existing)

### Internal

- No blocking dependencies
- All work can proceed in parallel

### Libraries to Add

- `lodash` (for debounce) - Already installed
- `@heroicons/react` (for status icons) - To install

---

## Timeline

| **Phase** | **Duration** | **Start Date** | **End Date** |
|-----------|--------------|----------------|--------------|
| Phase 1 | 3 hours | Day 1 | Day 1 |
| Phase 2 | 2 days | Day 2 | Day 3 |
| Phase 3 | 1 day | Day 4 | Day 4 |
| Phase 4 | 3 days | Day 5 | Day 7 |
| **Total** | **7 days** | - | - |

*Assumes full-time work. Adjust for actual availability.*

---

## Cost Analysis

### Development Cost

- Phase 1: 3 hours × $150/hr = $450
- Phase 2: 16 hours × $150/hr = $2,400
- Phase 3: 8 hours × $150/hr = $1,200
- Phase 4: 24 hours × $150/hr = $3,600
- **Total**: $7,650

### Infrastructure Cost

- No additional infrastructure required
- Supabase free tier sufficient for MVP
- Storage costs: $0.021/GB/month (negligible)

### ROI

- **Problem**: Users losing work → 50% churn
- **Solution**: Reliable persistence → Retain users
- **Value**: Each retained user = $X/month revenue
- **Break-even**: Y users retained

---

## Monitoring & Observability

### Metrics to Track

1. **Upload Success Rate**
   - Target: > 99%
   - Alert: < 95%

2. **Save Duration**
   - Target: < 2s
   - Alert: > 5s

3. **Error Rate**
   - Target: < 0.1%
   - Alert: > 1%

4. **Storage Usage**
   - Per user
   - Total across platform

5. **Retry Frequency**
   - How often retries needed
   - Which operations retry most

### Logging Strategy

```typescript
// Prefix all logs with category
console.log('[UPLOAD] Starting upload...')
console.log('[VERIFY] Checking file exists...')
console.log('[SAVE] Saving dashboard...')
console.error('[ERROR] Upload failed:', error)
```

### Future: Error Tracking

When user base > 50 users:
- Integrate Sentry for error tracking
- Track error frequency by type
- Alert on spikes in error rate

---

## Security Considerations

### Data Protection

- ✅ RLS policies enforce user isolation
- ✅ File paths scoped to user ID
- ✅ No cross-user data access
- ✅ Authenticated uploads only

### Input Validation

- Validate file size before upload
- Validate MIME type (CSV only)
- Sanitize file names
- Check for malicious content (future)

### Quota Enforcement

- Prevent storage abuse
- Soft limit: Warning at 80%
- Hard limit: Block at 100%
- Admin override capability

---

## Documentation Requirements

### User Documentation

- Update User Guide with save behavior
- Explain save status indicator
- Troubleshooting guide for upload errors

### Developer Documentation

- API documentation for new services
- Architecture diagrams
- Deployment instructions
- Testing procedures

### Runbook

- Common failure scenarios
- Recovery procedures
- Manual intervention steps
- Emergency rollback plan

---

## Future Enhancements

### Post-MVP Features

1. **Offline Support** - IndexedDB caching, background sync
2. **Batch Operations** - Upload/delete multiple files at once
3. **File Compression** - Gzip CSV files to save space
4. **Resumable Uploads** - For large files
5. **Delta Sync** - Only sync changed data
6. **Version History** - Undo/redo with snapshots
7. **Export/Import** - Download dashboard as ZIP

### Optimization Opportunities

1. **Parallel Uploads** - Upload multiple files concurrently
2. **Lazy Loading** - Load metrics on-demand
3. **Incremental Saves** - Only save changed metrics
4. **Caching Strategy** - Cache downloaded CSVs
5. **CDN Integration** - Edge caching for files

---

## Approval & Sign-Off

### Required Approvals

- [x] Technical Review - Architecture sound
- [x] Product Review - Meets user needs
- [ ] Security Review - No vulnerabilities (pending)
- [ ] Performance Review - Meets targets (pending)

### Next Steps

1. Review this proposal
2. Answer open questions
3. Approve for implementation
4. Begin Phase 1

---

## Appendix

### A. Related Documents

- [Implementation Plan](PERSISTENT_STORAGE_IMPLEMENTATION_PLAN.md)
- [Bug Report](BUG_REPORT_STORAGE_400_ERRORS.md)
- [RLS Policies](../sql/create_rls_policies.sql)

### B. Code Examples

See Implementation Plan for detailed code examples.

### C. Architecture Diagrams

See Three-Layer Persistence Model above.

### D. Database Schema

See Database Enhancements section.

---

**Document Status**: ✅ Complete and Ready for Implementation

**Last Updated**: January 8, 2026

**Next Action**: Review and approve, then begin Phase 1
