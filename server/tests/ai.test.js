const { ruleBasedClassifier, analyzeComplaint } = require('../src/services/geminiService');

describe('Gemini AI Service & Deterministic Fallback Tests', () => {
  it('should categorize water leak complaint into Water Supply with appropriate department & priority', () => {
    const result = ruleBasedClassifier(
      'Water pipe broken near market',
      'Continuous water leak wasting gallons of clean drinking water.'
    );

    expect(result.categorySuggestion).toBe('Water Supply');
    expect(result.departmentSuggestion).toBe('Water Supply & Sewerage');
    expect(result.isFallback).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.nextAction).toBeDefined();
  });

  it('should categorize spark / live wire into Electricity with Urgent priority', () => {
    const result = ruleBasedClassifier(
      'Transformer sparking violently',
      'Electric spark coming from pole wire fallen on the street.'
    );

    expect(result.categorySuggestion).toBe('Electricity');
    expect(result.prioritySuggestion).toBe('Urgent');
    expect(result.isFallback).toBe(true);
  });

  it('should categorize garbage / cleanliness into Sanitation and Waste Management', () => {
    const result = ruleBasedClassifier(
      'Garbage pile rotting on sidewalk',
      'Uncollected trash and waste causing severe stench and health hazard.'
    );

    expect(result.categorySuggestion).toBe('Sanitation and Waste Management');
    expect(result.departmentSuggestion).toBe('Sanitation & Waste Management');
  });

  it('should categorize Hindi input correctly (e.g. पानी, बिजली, कचरा)', () => {
    const waterHindi = ruleBasedClassifier('पानी की पाइप टूटी है', 'गली में पीने का पानी बह रहा है');
    expect(waterHindi.categorySuggestion).toBe('Water Supply');

    const electricHindi = ruleBasedClassifier('बिजली के तार गिरे हैं', 'खंभे से तार गिर गया है');
    expect(electricHindi.categorySuggestion).toBe('Electricity');
  });

  it('should gracefully handle analyzeComplaint without crashing when no API key is provided', async () => {
    const result = await analyzeComplaint({
      title: 'Pothole on main avenue',
      description: 'Deep road potholes causing traffic disruption and minor bike accidents.',
      location: { address: 'Main Ring Road' },
    });

    expect(result).toBeDefined();
    expect(result.categorySuggestion).toBe('Roads and Infrastructure');
    expect(result.isFallback).toBe(true);
  });
});
