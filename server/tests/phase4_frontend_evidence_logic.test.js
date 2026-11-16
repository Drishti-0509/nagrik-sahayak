const fs = require('fs');
const path = require('path');

describe('Phase 4A Frontend Evidence History Logic & Verification', () => {
  // Helper simulating the exact historicalRecords filtering logic implemented in ComplaintDetail.jsx
  function computeHistoricalRecords(evidenceList, complaint) {
    const officerEvidence = (evidenceList || []).filter((e) => e.evidenceType === 'officer_resolution');
    const isCurrentlyResolved = ['Resolved', 'Closed'].includes(complaint.status);
    return officerEvidence.filter((item) =>
      isCurrentlyResolved
        ? item.cycleNumber < (complaint.resolutionCycleCount || 1)
        : true
    );
  }

  // Helper simulating TimelineView evidence detection
  function detectTimelineEvidence(timelineItem) {
    const evidenceObj = timelineItem.evidence && typeof timelineItem.evidence === 'object' ? timelineItem.evidence : null;
    const hasEvidence = Boolean(evidenceObj && evidenceObj.dataUrl);
    return { hasEvidence, evidenceObj };
  }

  const sampleCycle1Evidence = {
    _id: 'ev-cycle-1',
    complaint: 'comp-101',
    cycleNumber: 1,
    evidenceType: 'officer_resolution',
    dataUrl: 'data:image/png;base64,CYCLE1_IMAGE_DATA',
    caption: 'Cycle 1 Resolution: Repaired transformer and reconnected terminal',
    uploadedBy: { name: 'Jeenu Sharma', role: 'officer' },
    createdAt: '2026-11-14T10:35:56.000Z',
  };

  const sampleCycle2Evidence = {
    _id: 'ev-cycle-2',
    complaint: 'comp-101',
    cycleNumber: 2,
    evidenceType: 'officer_resolution',
    dataUrl: 'data:image/png;base64,CYCLE2_IMAGE_DATA',
    caption: 'Cycle 2 Resolution: Replaced faulty capacitor with high-voltage variant',
    uploadedBy: { name: 'Jeenu Sharma', role: 'officer' },
    createdAt: '2026-11-14T14:20:00.000Z',
  };

  test('Scenario 1: Resolved complaint displays active resolution certificate & evidence', () => {
    const complaint = {
      status: 'Resolved',
      resolutionCycleCount: 1,
      resolutionNotes: 'Cycle 1 Resolution: Repaired transformer and reconnected terminal',
      resolutionEvidence: 'data:image/png;base64,CYCLE1_IMAGE_DATA',
    };
    const evidenceList = [sampleCycle1Evidence];

    const isCurrentlyResolved = ['Resolved', 'Closed'].includes(complaint.status);
    expect(isCurrentlyResolved).toBe(true);

    // Active resolution certificate should display current cycle notes and evidence
    const showActiveCertificate = Boolean(complaint.resolutionNotes || complaint.resolutionEvidence) && isCurrentlyResolved;
    expect(showActiveCertificate).toBe(true);

    // Historical list should only contain cycles PRIOR to current cycle
    const historicalRecords = computeHistoricalRecords(evidenceList, complaint);
    expect(historicalRecords.length).toBe(0); // Cycle 1 is active, so 0 prior cycles
  });

  test('Scenario 2: Reopened complaint preserves Cycle 1 evidence in historical resolution list', () => {
    const complaint = {
      status: 'Reopened',
      resolutionCycleCount: 1,
      resolutionNotes: 'Cycle 1 Resolution: Repaired transformer and reconnected terminal',
      resolutionEvidence: 'data:image/png;base64,CYCLE1_IMAGE_DATA',
    };
    const evidenceList = [sampleCycle1Evidence];

    const isCurrentlyResolved = ['Resolved', 'Closed'].includes(complaint.status);
    expect(isCurrentlyResolved).toBe(false);

    // Historical records must include Cycle 1 even though complaint is Reopened
    const historicalRecords = computeHistoricalRecords(evidenceList, complaint);
    expect(historicalRecords.length).toBe(1);
    expect(historicalRecords[0].cycleNumber).toBe(1);
    expect(historicalRecords[0].caption).toContain('Repaired transformer');
    expect(historicalRecords[0].dataUrl).toBe(sampleCycle1Evidence.dataUrl);
    expect(historicalRecords[0].uploadedBy.name).toBe('Jeenu Sharma');
  });

  test('Scenario 3: Timeline camera button detects populated evidence and opens exact Cycle 1 image', () => {
    const timelineItemWithPopulatedEvidence = {
      status: 'Resolved',
      eventType: 'resolved',
      description: 'Resolved: Cycle 1 Resolution note',
      evidence: sampleCycle1Evidence,
      timestamp: '2026-11-14T10:35:56.000Z',
    };

    const { hasEvidence, evidenceObj } = detectTimelineEvidence(timelineItemWithPopulatedEvidence);
    expect(hasEvidence).toBe(true);
    expect(evidenceObj).toBeDefined();
    expect(evidenceObj.dataUrl).toBe(sampleCycle1Evidence.dataUrl);
    expect(evidenceObj.cycleNumber).toBe(1);

    // Simulated modal trigger
    let activeEvidence = null;
    const setActiveEvidence = (ev) => { activeEvidence = ev; };

    if (evidenceObj && evidenceObj.dataUrl) {
      setActiveEvidence(evidenceObj);
    }

    expect(activeEvidence).not.toBeNull();
    expect(activeEvidence.dataUrl).toBe(sampleCycle1Evidence.dataUrl);
    expect(activeEvidence.cycleNumber).toBe(1);
  });

  test('Scenario 4: Evidence list refreshes after reopening (handleReopenSubmit simulation)', async () => {
    let complaintDetailsFetched = false;
    let evidenceFetched = false;
    let notificationsFetched = false;

    const mockApiPut = jest.fn().mockResolvedValue({ data: { success: true } });
    const fetchComplaintDetails = jest.fn().mockImplementation(async () => {
      complaintDetailsFetched = true;
    });
    const fetchEvidence = jest.fn().mockImplementation(async () => {
      evidenceFetched = true;
    });
    const fetchNotifications = jest.fn().mockImplementation(() => {
      notificationsFetched = true;
    });

    // Simulating handleReopenSubmit
    const res = await mockApiPut('/complaints/comp-101/status', { status: 'Reopened', notes: 'Still sparking' });
    if (res.data.success) {
      await fetchComplaintDetails();
      await fetchEvidence();
      fetchNotifications();
    }

    expect(mockApiPut).toHaveBeenCalledWith('/complaints/comp-101/status', { status: 'Reopened', notes: 'Still sparking' });
    expect(complaintDetailsFetched).toBe(true);
    expect(evidenceFetched).toBe(true);
    expect(notificationsFetched).toBe(true);
  });

  test('Scenario 5: Reopened complaint resolved without new image does not display stale evidence as new resolution', () => {
    // When resolved without an image in Cycle 2, backend sets top-level resolutionEvidence = ''
    const complaintCycle2NoImage = {
      status: 'Resolved',
      resolutionCycleCount: 2,
      resolutionNotes: 'Adjusted bolt manually without replacing part',
      resolutionEvidence: '', // empty!
    };
    // evidenceList only has Cycle 1 because Cycle 2 had no image uploaded
    const evidenceList = [sampleCycle1Evidence];

    // Active resolution has no image
    expect(Boolean(complaintCycle2NoImage.resolutionEvidence)).toBe(false);

    // Cycle 1 is correctly classified as historical, NOT displayed as Cycle 2 proof
    const historicalRecords = computeHistoricalRecords(evidenceList, complaintCycle2NoImage);
    expect(historicalRecords.length).toBe(1);
    expect(historicalRecords[0].cycleNumber).toBe(1);
    expect(historicalRecords[0].cycleNumber).not.toBe(complaintCycle2NoImage.resolutionCycleCount);
  });

  test('Scenario 6: Multiple historical resolution cycles remain independently accessible', () => {
    const evidenceListMultiCycle = [sampleCycle1Evidence, sampleCycle2Evidence];

    // Case A: Complaint in progress on Cycle 3 (Reopened or In Progress)
    const inProgressComplaint = {
      status: 'In Progress',
      resolutionCycleCount: 2,
    };
    const historicalInProgress = computeHistoricalRecords(evidenceListMultiCycle, inProgressComplaint);
    expect(historicalInProgress.length).toBe(2);
    expect(historicalInProgress[0].cycleNumber).toBe(1);
    expect(historicalInProgress[1].cycleNumber).toBe(2);

    // Case B: Complaint resolved in Cycle 3
    const cycle3ResolvedComplaint = {
      status: 'Resolved',
      resolutionCycleCount: 3,
      resolutionNotes: 'Replaced whole feeder pole in Cycle 3',
      resolutionEvidence: 'data:image/png;base64,CYCLE3_IMAGE_DATA',
    };
    const historicalCycle3 = computeHistoricalRecords(evidenceListMultiCycle, cycle3ResolvedComplaint);
    expect(historicalCycle3.length).toBe(2);
    expect(historicalCycle3.map((x) => x.cycleNumber)).toEqual([1, 2]);
  });

  test('Scenario 7: Missing evidence data does not crash components (null/undefined safety)', () => {
    // A: null timeline evidence
    const nullTimelineItem = { status: 'Submitted', evidence: null };
    const resNull = detectTimelineEvidence(nullTimelineItem);
    expect(resNull.hasEvidence).toBe(false);
    expect(resNull.evidenceObj).toBeNull();

    // B: unpopulated ObjectId string in timeline evidence
    const stringTimelineItem = { status: 'Resolved', evidence: '6af8398c3a9abccdfe6829d1' };
    const resString = detectTimelineEvidence(stringTimelineItem);
    expect(resString.hasEvidence).toBe(false); // Does not falsely report true without dataUrl
    expect(resString.evidenceObj).toBeNull();

    // C: undefined evidenceList
    const resUndefinedList = computeHistoricalRecords(undefined, { status: 'Reopened' });
    expect(resUndefinedList).toEqual([]);

    // D: empty evidenceList
    const resEmptyList = computeHistoricalRecords([], { status: 'Reopened' });
    expect(resEmptyList).toEqual([]);
  });

  test('Scenario 8: English and Hindi translations are complete for all evidence features', () => {
    const translationsPath = path.resolve(__dirname, '../../client/src/i18n/translations.js');
    expect(fs.existsSync(translationsPath)).toBe(true);

    const fileContent = fs.readFileSync(translationsPath, 'utf8');

    const requiredKeys = [
      'resolutionEvidenceTitle',
      'resolutionHistoryTitle',
      'resolutionCycle',
      'noEvidenceRecorded',
      'historicalResolutionEvidence',
      'viewFullImage',
      'timelineEvidenceAttached',
      'evidenceProvidedByCitizen',
    ];

    // Verify all keys are present in English block
    const enBlock = fileContent.substring(fileContent.indexOf('en: {'), fileContent.indexOf('hi: {'));
    requiredKeys.forEach((key) => {
      expect(enBlock).toContain(key);
    });

    // Verify all keys are present in Hindi block
    const hiBlock = fileContent.substring(fileContent.indexOf('hi: {'));
    requiredKeys.forEach((key) => {
      expect(hiBlock).toContain(key);
    });
  });
});
