import React, { useState, useEffect, useRef } from 'react';
import type { ExplainResponse, ModelStatus } from './types';
import { fetchModelStatus, explainScan } from './api';
import './App.css';

const DR_SEVERITY_META: Record<number, { label: string; badgeClass: string; description: string }> = {
  0: {
    label: 'No DR (Stage 0)',
    badgeClass: 'badge-nodr',
    description: 'No microaneurysms or retinal lesions detected. Routine annual screening recommended.',
  },
  1: {
    label: 'Mild DR (Stage 1)',
    badgeClass: 'badge-mild',
    description: 'Microaneurysms present. Early non-proliferative changes; glycemic control and monitoring advised.',
  },
  2: {
    label: 'Moderate DR (Stage 2)',
    badgeClass: 'badge-moderate',
    description: 'More extensive microaneurysms, hemorrhages, or hard exudates. Triage for clinical evaluation.',
  },
  3: {
    label: 'Severe DR (Stage 3)',
    badgeClass: 'badge-severe',
    description: 'Severe non-proliferative DR (4-2-1 rule features). High risk of progression to proliferative DR.',
  },
  4: {
    label: 'Proliferative DR (Stage 4)',
    badgeClass: 'badge-proliferative',
    description: 'Neovascularization or vitreous/preretinal hemorrhage observed. Urgent ophthalmology referral required.',
  },
};

interface PatientExplanationContent {
  summary: string;
  meaning: string;
  advice: string;
}

const PATIENT_FRIENDLY_EXPLANATIONS: Record<
  string,
  { en: PatientExplanationContent; hi: PatientExplanationContent }
> = {
  'Stage 0: No Diabetic Retinopathy': {
    en: {
      summary: 'No diabetic damage found in your eyes (Normal retina)',
      meaning:
        'The photo of the back of your eye looks healthy. High blood sugar has not damaged the blood vessels inside your eyes at this time.',
      advice:
        'Continue taking your diabetes medicines, eating healthy food, and get your eyes re-checked once every year.',
    },
    hi: {
      summary: 'आँखों में कोई डायबिटिक क्षति नहीं मिली (सामान्य रेटिना)',
      meaning:
        'आपकी आँख के पिछले हिस्से (रेटिना) की तस्वीर बिल्कुल स्वस्थ है। बढ़े हुए ब्लड शुगर ने अभी तक आपकी आँखों की नसों को नुकसान नहीं पहुँचाया है।',
      advice:
        'अपनी शुगर की दवाइयां नियमित लेते रहें, संतुलित भोजन करें और हर साल आँखों की नियमित जांच अवश्य करवाएं।',
    },
  },
  'Stage 1: Mild Non-Proliferative DR': {
    en: {
      summary: 'Very early changes in the eye vessels',
      meaning:
        'A few tiny blood vessels in the back of your eye have small weak spots or swellings. Your eyesight is still protected, but your eyes are showing the first signs of diabetes.',
      advice:
        'Keep your daily blood sugar in good control to stop this from growing into serious eye damage.',
    },
    hi: {
      summary: 'आँखों की नसों में बहुत शुरुआती बदलाव',
      meaning:
        'आपकी आँख के पिछले हिस्से में खून की बारीक नसों में हल्की सूजन आई है। अभी आपकी नज़र को कोई नुकसान नहीं हुआ है, लेकिन यह डायबिटीज़ का पहला असर है।',
      advice:
        'अपने ब्लड शुगर को पूरी तरह नियंत्रण में रखें ताकि यह समस्या आगे न बढ़े।',
    },
  },
  'Stage 2: Moderate Non-Proliferative DR': {
    en: {
      summary: 'Moderate diabetic eye damage',
      meaning:
        'Some tiny blood vessels in your eye have become blocked or are leaking small drops of fluid. This can harm your eyesight if it is ignored.',
      advice:
        'Follow your doctor\'s exact instructions, keep your blood pressure and sugar low, and attend your eye checkups on time.',
    },
    hi: {
      summary: 'आँखों में मध्यम स्तर का डायबिटिक प्रभाव',
      meaning:
        'आँख के पर्दे की कुछ बारीक नसें बंद हो गई हैं या उनसे हल्का रिसाव हो रहा है। अगर इस पर ध्यान नहीं दिया गया तो यह आपकी नज़र को कमजोर कर सकता है।',
      advice:
        'डॉक्टर के निर्देशों का पूरा पालन करें, शुगर और बीपी कंट्रोल में रखें और तय समय पर जांच के लिए आएं।',
    },
  },
  'Stage 3: Severe Non-Proliferative DR': {
    en: {
      summary: 'Severe diabetic eye damage (High danger to eyesight)',
      meaning:
        'Many blood vessels in your retina are blocked, cutting off oxygen and blood flow to your eye. Your eye is at high risk of sudden bleeding and loss of sight.',
      advice:
        'You must visit an eye specialist (retina doctor) without delay as instructed by your clinician.',
    },
    hi: {
      summary: 'गंभीर डायबिटिक क्षति (नज़र के लिए बड़ा ख़तरा)',
      meaning:
        'आपकी आँख की कई रक्त वाहिकाएं बंद हो चुकी हैं जिससे आँख को पर्याप्त ऑक्सीजन नहीं मिल पा रही है। इससे अचानक नज़र कमजोर होने का बहुत बड़ा ख़तरा है।',
      advice:
        'बिना किसी देरी के तुरंत नेत्र रोग विशेषज्ञ (रेटिना डॉक्टर) को दिखाएं, जैसा कि आपके डॉक्टर ने सलाह दी है।',
    },
  },
  'Stage 4: Proliferative DR': {
    en: {
      summary: 'Advanced diabetic eye disease (Urgent medical care needed)',
      meaning:
        'New, fragile blood vessels have started growing inside your eye. These can break, bleed heavily, or cause the retina to pull away, leading to severe blindness if not treated quickly.',
      advice:
        'Seek urgent medical treatment at an eye hospital. Timely laser or injection procedures can save your eyesight.',
    },
    hi: {
      summary: 'अत्यधिक गंभीर डायबिटिक स्थिति (तत्काल उपचार ज़रूरी)',
      meaning:
        'आपकी आँख में नई कमजोर नसें उगने लगी हैं, जिनसे खून का रिसाव हो सकता है। समय पर इलाज न मिलने पर इससे हमेशा के लिए दृष्टि जा सकती है।',
      advice:
        'नेत्र अस्पताल में तत्काल इलाज कराएं। समय पर लेज़र या इंजेक्शन उपचार आपकी आँखों की रोशनी बचा सकता है।',
    },
  },
  'Inconclusive / Ungradable Quality Scan': {
    en: {
      summary: 'Retinal photograph could not be clearly read',
      meaning:
        'The picture taken of the back of your eye was hazy, dark, or out of focus (often caused by small pupils, eye cataracts, or camera glare).',
      advice:
        'Please have another photo taken or visit an eye clinic for an in-person eye drop exam.',
    },
    hi: {
      summary: 'आँख की तस्वीर पूरी तरह स्पष्ट नहीं आई',
      meaning:
        'आँख के पिछले हिस्से की तस्वीर धुंधली या अपर्याप्त रोशनी की वजह से साफ नहीं दिख सकी (मोतियाबिंद या पुतली छोटी होने के कारण)।',
      advice:
        'कृपया दोबारा तस्वीर खिंचवाएं या आँख में दवा डलवाकर अस्पताल में प्रत्यक्ष जांच कराएं।',
    },
  },
};

type Language = 'en' | 'hi';

const UI_STRINGS = {
  en: {
    langName: 'English',
    selectLang: 'Language',
    patientGuideTitle: 'Patient Care Summary & Plain-Language Guide',
    patientGuideSubtitle:
      'Simplified explanation of your eye exam and treatment plan, designed for clear patient and family understanding.',
    patientBadge: 'Patient Guide',
    patientDisclaimer:
      'Important Patient Notice: This is a simplified explanation of your clinician\'s plan. It does not replace your doctor\'s advice.',
    conditionTitle: 'Your Eye Health Condition',
    confirmedAssessmentLabel: 'Doctor\'s Confirmed Assessment:',
    whatThisMeansLabel: 'What This Means In Simple Words:',
    generalAdviceLabel: 'General Advice for this Stage:',
    treatmentTitle: 'Doctor-Entered Treatment & Medication',
    treatmentSafetyNote:
      'The details below are displayed exactly as entered by your clinician. VisionNexa does not alter, invent, or recommend any medication or treatment.',
    treatmentLabel: 'Treatment / Medication:',
    dosageLabel: 'Dosage & Frequency (How to take it):',
    durationLabel: 'Duration (How long):',
    followUpDateLabel: 'Next Follow-up Date:',
    instructionsLabel: 'Clinical Instructions:',
    notProvided: 'Not provided by clinician',
    tipsTitle: '3 Simple Rules to Protect Your Eyesight',
    tip1: '1. Test Sugar & Blood Pressure Regularly: High blood sugar damages small eye blood vessels silently without pain in early stages.',
    tip2: '2. Do Not Stop Prescribed Medicines: Take your daily diabetes medicines and any doctor-prescribed eye medicines on schedule.',
    tip3: '3. Never Miss Your Next Eye Checkup: Timely treatment prevents vision loss. Do not wait for eyesight to become blurry before seeing a doctor.',
    reminderTitle: 'Follow-up & Clinic Visit Reminder',
    reminderSubtitle: 'Personalized reminder based on your clinician\'s scheduled checkup date.',
    reminderNotice:
      'Important Notice: This reminder is based on the follow-up date entered by your clinician. It does not replace medical advice.',
    nextVisitLabel: 'Next Follow-up Date:',
    statusLabel: 'Follow-up Status:',
    messageLabel: 'Patient Reminder Message:',
    ackBtn: '✓ Acknowledge Reminder (I have noted this)',
    ackTitle: 'Reminder Acknowledged (Noted by patient / caregiver)',
    ackMetaPrefix: 'Acknowledged on',
    editAckBtn: 'Edit',
  },
  hi: {
    langName: 'हिंदी',
    selectLang: 'भाषा (Language)',
    patientGuideTitle: 'मरीज़ देखभाल सारांश व सरल मार्गदर्शिका',
    patientGuideSubtitle:
      'आपकी आँखों की जांच और उपचार योजना का सरल विवरण, ताकि आप और आपका परिवार इसे आसानी से समझ सकें।',
    patientBadge: 'मरीज़ मार्गदर्शिका',
    patientDisclaimer:
      'महत्वपूर्ण मरीज़ सूचना: यह आपके डॉक्टर की योजना का सरल विवरण है। यह आपके डॉक्टर की सलाह का स्थान नहीं लेता है।',
    conditionTitle: 'आपकी आँखों की स्थिति (नेत्र स्वास्थ्य)',
    confirmedAssessmentLabel: 'डॉक्टर द्वारा निर्धारित जांच परिणाम:',
    whatThisMeansLabel: 'आसान शब्दों में इसका क्या अर्थ है:',
    generalAdviceLabel: 'इस स्थिति के लिए सामान्य परामर्श:',
    treatmentTitle: 'डॉक्टर द्वारा निर्धारित उपचार व दवाइयां',
    treatmentSafetyNote:
      'नीचे दी गई जानकारी ठीक वैसी ही दिखाई गई है जैसी आपके डॉक्टर ने दर्ज की है। VisionNexa (विज़ननेक्सा) किसी भी दवा या उपचार को बदलता, बनाता या अनुशंसित नहीं करता है।',
    treatmentLabel: 'दवा / उपचार:',
    dosageLabel: 'खुराक और समय (दवा कैसे लें):',
    durationLabel: 'अवधि (कितने दिनों तक):',
    followUpDateLabel: 'अगली जांच की तारीख:',
    instructionsLabel: 'डॉक्टर के विशेष निर्देश:',
    notProvided: 'डॉक्टर द्वारा दर्ज नहीं किया गया',
    tipsTitle: 'आँखों की रोशनी सुरक्षित रखने के 3 ज़रूरी नियम',
    tip1: '1. शुगर और ब्लड प्रेशर की नियमित जांच कराएं: बढ़ा हुआ ब्लड शुगर बिना किसी दर्द के आँखों की बारीक नसों को चुपचाप नुकसान पहुँचाता है।',
    tip2: '2. अपनी दवाइयां कभी बीच में न छोड़ें: अपनी नियमित शुगर की दवाइयां और डॉक्टर द्वारा बताई गई आँखों की दवा समय पर लें।',
    tip3: '3. अगली जांच की तारीख कभी न भूलें: समय पर जांच और इलाज कराने से आँखों की रोशनी सुरक्षित रहती है। नज़र धुंधली होने का इंतज़ार न करें।',
    reminderTitle: 'अगली जांच व अस्पताल आने की याददिहानी',
    reminderSubtitle: 'आपके डॉक्टर द्वारा तय की गई तारीख के आधार पर आपकी याददिहानी।',
    reminderNotice:
      'महत्वपूर्ण सूचना: यह रिमाइंडर आपके डॉक्टर द्वारा दर्ज की गई तारीख पर आधारित है। यह चिकित्सीय सलाह का स्थान नहीं लेता है।',
    nextVisitLabel: 'अगली जांच की तारीख:',
    statusLabel: 'वर्तमान स्थिति:',
    messageLabel: 'मरीज़ के लिए आवश्यक संदेश:',
    ackBtn: '✓ मैंने समझ लिया (याददिहानी स्वीकार की)',
    ackTitle: 'याददिहानी स्वीकार की गई (मरीज़ / परिजन द्वारा पुष्टिकृत)',
    ackMetaPrefix: 'स्वीकार किया गया',
    editAckBtn: 'बदलें / रीसेट करें',
  },
};

interface DoctorReview {
  finalAssessment: string;
  clinicalNotes: string;
  recommendedNextStep: string;
  confirmed: boolean;
  confirmedAt?: string;
}

const INITIAL_DOCTOR_REVIEW: DoctorReview = {
  finalAssessment: '',
  clinicalNotes: '',
  recommendedNextStep: '',
  confirmed: false,
};

interface ClinicalPlan {
  treatment: string;
  dosageFrequency: string;
  duration: string;
  clinicalInstructions: string;
  followUpDate: string;
  saved: boolean;
  savedAt?: string;
}

const INITIAL_CLINICAL_PLAN: ClinicalPlan = {
  treatment: '',
  dosageFrequency: '',
  duration: '',
  clinicalInstructions: '',
  followUpDate: '',
  saved: false,
};

const getFollowUpStatus = (dateStr: string) => {
  if (!dateStr || !dateStr.trim()) {
    return {
      type: 'no_date',
      statusEn: 'No Follow-up Date Set',
      statusHi: 'तारीख निर्धारित नहीं',
      badgeClass: 'badge-status-neutral',
      messageEn:
        'Your clinician has not specified a calendar date for your next follow-up. Please follow the clinical instructions and advice given above.',
      messageHi:
        'डॉक्टर द्वारा कोई विशिष्ट तारीख नहीं दी गई है। कृपया ऊपर दिए गए निर्देशों और सलाह का पालन करें।',
      formattedDate: 'Not provided by clinician / डॉक्टर द्वारा नहीं दी गई',
    };
  }

  const parts = dateStr.split('-');
  if (parts.length !== 3) {
    return {
      type: 'custom',
      statusEn: 'Date Scheduled',
      statusHi: 'तारीख तय है',
      badgeClass: 'badge-status-upcoming',
      messageEn: `Your next eye checkup is scheduled for ${dateStr}. Please attend on time.`,
      messageHi: `आपकी अगली जांच ${dateStr} को तय की गई है। कृपया समय पर पहुंचें।`,
      formattedDate: dateStr,
    };
  }

  const targetDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);

  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const enDateFormatted = targetDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (diffDays > 0) {
    return {
      type: 'upcoming',
      statusEn: `Upcoming (${diffDays} day${diffDays === 1 ? '' : 's'} remaining)`,
      statusHi: `आगामी (${diffDays} दिन शेष)`,
      badgeClass: 'badge-status-upcoming',
      messageEn: `Your next eye checkup is scheduled for ${enDateFormatted}. Regular follow-up ensures any changes in your retina are caught and treated early.`,
      messageHi: `आपकी अगली जांच ${enDateFormatted} को तय है। समय पर जांच कराने से आँखों की रोशनी सुरक्षित रहती है।`,
      formattedDate: enDateFormatted,
    };
  } else if (diffDays === 0) {
    return {
      type: 'due_today',
      statusEn: 'Due Today (आज ही जाएं)',
      statusHi: 'आज ही जांच कराएं',
      badgeClass: 'badge-status-due-today',
      messageEn: `Your eye follow-up visit is due TODAY (${enDateFormatted}). Please visit your designated eye clinic or hospital as planned.`,
      messageHi: `आपकी जांच की तारीख आज ही है (${enDateFormatted})। कृपया आज ही अस्पताल या नेत्र केंद्र जाएं।`,
      formattedDate: enDateFormatted,
    };
  } else {
    const overdueDays = Math.abs(diffDays);
    return {
      type: 'overdue',
      statusEn: `Overdue (by ${overdueDays} day${overdueDays === 1 ? '' : 's'})`,
      statusHi: `तारीख निकल चुकी है (${overdueDays} दिन पूर्व)`,
      badgeClass: 'badge-status-overdue',
      messageEn: `Your scheduled follow-up date was ${enDateFormatted} (${overdueDays} day${overdueDays === 1 ? '' : 's'} ago). To prevent diabetic eye complications, please contact your eye care clinic promptly.`,
      messageHi: `आपकी जांच की तारीख ${enDateFormatted} को थी जो निकल चुकी है। अपनी आँखों की सुरक्षा के लिए जल्द से जल्द डॉक्टर से मिलें।`,
      formattedDate: enDateFormatted,
    };
  }
};

export default function App() {
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null);
  const [modelStatusError, setModelStatusError] = useState<string | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExplainResponse | null>(null);

  // Doctor Review state
  const [doctorReview, setDoctorReview] = useState<DoctorReview>(INITIAL_DOCTOR_REVIEW);

  // Clinical Plan state
  const [clinicalPlan, setClinicalPlan] = useState<ClinicalPlan>(INITIAL_CLINICAL_PLAN);

  // Follow-up Reminder acknowledgment state
  const [reminderAcknowledged, setReminderAcknowledged] = useState<boolean>(false);
  const [reminderAcknowledgedAt, setReminderAcknowledgedAt] = useState<string | null>(null);

  // Rural-friendly Language selection: 'en' or 'hi'
  const [language, setLanguage] = useState<Language>('en');

  const [activeTab, setActiveTab] = useState<'all' | 'overlay' | 'heatmap' | 'original'>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check backend and model status on component mount
  useEffect(() => {
    fetchModelStatus()
      .then((status) => {
        setModelStatus(status);
        setModelStatusError(null);
      })
      .catch((err) => {
        setModelStatusError(err.message || 'Unable to connect to VisionNexa backend');
      });
  }, []);

  const handleFileChange = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPEG, PNG, WEBP).');
      return;
    }
    setError(null);
    setResult(null);
    setDoctorReview(INITIAL_DOCTOR_REVIEW);
    setClinicalPlan(INITIAL_CLINICAL_PLAN);
    setReminderAcknowledged(false);
    setReminderAcknowledgedAt(null);
    setSelectedFile(file);

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select or drop a retinal fundus image first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDoctorReview(INITIAL_DOCTOR_REVIEW);
    setClinicalPlan(INITIAL_CLINICAL_PLAN);
    setReminderAcknowledged(false);
    setReminderAcknowledgedAt(null);

    try {
      const response = await explainScan(selectedFile);
      setResult(response);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred during screening.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setDoctorReview(INITIAL_DOCTOR_REVIEW);
    setClinicalPlan(INITIAL_CLINICAL_PLAN);
    setReminderAcknowledged(false);
    setReminderAcknowledgedAt(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const severityInfo = result ? DR_SEVERITY_META[result.predicted_class_id] : null;
  const followUpInfo = getFollowUpStatus(clinicalPlan.followUpDate);
  const t = UI_STRINGS[language];

  const patientContent = doctorReview.finalAssessment
    ? (PATIENT_FRIENDLY_EXPLANATIONS[doctorReview.finalAssessment]?.[language] || {
        summary: doctorReview.finalAssessment,
        meaning:
          language === 'hi'
            ? 'डॉक्टर ने आपकी आँख की तस्वीर का परीक्षण करके ऊपर दिया गया निष्कर्ष दर्ज किया है।'
            : 'The clinician has examined your retinal photo and recorded the assessment above.',
        advice:
          language === 'hi'
            ? 'कृपया नीचे दी गई डॉक्टर की सलाह का पालन करें और समय पर अस्पताल आएं।'
            : 'Follow the clinician-prescribed plan below and attend all recommended checkups.',
      })
    : null;

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        <div className="header-brand">
          <div className="logo-icon">👁️</div>
          <div>
            <h1 className="brand-title">VisionNexa <span className="brand-hindi">विज़ननेक्सा</span></h1>
            <p className="brand-subtitle">
              Explainable AI System for Diabetic Retinopathy Screening in Rural India
            </p>
          </div>
        </div>
        <div className="header-meta">
          {/* Rural Accessibility Language Selector */}
          <div className="language-selector" role="group" aria-label="Select Language / भाषा चुनें">
            <span className="language-label-prefix" aria-hidden="true">🌐</span>
            <button
              type="button"
              className={`lang-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
              aria-pressed={language === 'en'}
            >
              English
            </button>
            <button
              type="button"
              className={`lang-btn ${language === 'hi' ? 'active' : ''}`}
              onClick={() => setLanguage('hi')}
              aria-pressed={language === 'hi'}
            >
              हिंदी
            </button>
          </div>

          <div className="backend-indicator">
            <span
              className={`status-dot ${modelStatus?.model_loaded ? 'status-online' : 'status-offline'}`}
            ></span>
            <span className="status-text">
              {modelStatus?.model_loaded
                ? `Model Online (${modelStatus.model_architecture} on ${modelStatus.device.toUpperCase()})`
                : modelStatusError
                ? 'Backend Disconnected'
                : 'Loading model...'}
            </span>
          </div>
        </div>
      </header>

      {/* Safety Disclaimer Banner */}
      <div className="disclaimer-banner" role="alert">
        <span className="disclaimer-icon">⚠️</span>
        <div className="disclaimer-content">
          <strong>Clinical Decision Support Disclaimer:</strong> VisionNexa provides automated
          screening triage and visual explanation (Grad-CAM) to assist healthcare workers and optometrists in remote clinics.
          It does <em>not</em> provide a definitive medical diagnosis. All flagged cases must undergo confirmatory clinical examination by an ophthalmologist.
        </div>
      </div>

      <main className="main-content">
        {/* Left Column: Upload and Controls */}
        <section className="upload-panel card">
          <h2 className="panel-title">1. Retinal Fundus Scan Input</h2>
          <p className="panel-instruction">
            Upload a retinal fundus photograph (macula-centered or disc-centered) to evaluate for Diabetic Retinopathy severity.
          </p>

          <form onSubmit={handleSubmit}>
            <div
              className={`dropzone ${previewUrl ? 'has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden-file-input"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {previewUrl ? (
                <div className="preview-container">
                  <img src={previewUrl} alt="Retinal fundus preview" className="input-preview-image" />
                  <p className="preview-filename">{selectedFile?.name}</p>
                  <p className="preview-hint">Click or drop another image to replace</p>
                </div>
              ) : (
                <div className="dropzone-prompt">
                  <div className="upload-icon">📤</div>
                  <p className="dropzone-text">
                    <strong>Click to select</strong> or drag and drop a retinal fundus image here
                  </p>
                  <p className="dropzone-formats">Supported formats: JPEG, PNG, WEBP (224×224 normalized)</p>
                </div>
              )}
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <strong>Error:</strong> {error}
              </div>
            )}

            <div className="action-buttons">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!selectedFile || isLoading || !modelStatus?.model_loaded}
              >
                {isLoading ? (
                  <>
                    <span className="spinner"></span>
                    Running Inference &amp; Grad-CAM...
                  </>
                ) : (
                  'Analyze Retinal Scan'
                )}
              </button>

              {selectedFile && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleReset}
                  disabled={isLoading}
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {/* Model Specification Info */}
          <div className="model-spec-card">
            <h3 className="spec-title">⚙️ Architecture &amp; XAI Pipeline</h3>
            <ul className="spec-list">
              <li><strong>Backbone:</strong> {modelStatus?.model_architecture || 'EfficientNet-B0'}</li>
              <li><strong>Resolution:</strong> 224 × 224 px (ImageNet normalized)</li>
              <li><strong>Explainability:</strong> Gradient-weighted Class Activation Mapping (Grad-CAM)</li>
              <li><strong>Target Layer:</strong> <code>model.features[-1]</code></li>
              <li><strong>Classes:</strong> 5 stages (0: No DR, 1: Mild, 2: Moderate, 3: Severe, 4: Proliferative)</li>
            </ul>
          </div>
        </section>

        {/* Right Column: Screening & Grad-CAM Results */}
        <section className="results-panel card">
          <h2 className="panel-title">2. Screening &amp; Explainability Results</h2>

          {isLoading && (
            <div className="loading-state">
              <div className="large-spinner"></div>
              <h3>Evaluating Retinal Features...</h3>
              <p>Passing fundus image through PyTorch EfficientNet-B0 backbone and generating Grad-CAM heatmaps from the final convolutional layer.</p>
            </div>
          )}

          {!isLoading && !result && (
            <div className="empty-state">
              <div className="empty-state-icon">🔬</div>
              <h3>Awaiting Retinal Scan</h3>
              <p>Upload a fundus scan on the left and click <strong>Analyze Retinal Scan</strong> to view the real-time AI classification and Grad-CAM interpretability overlay.</p>
            </div>
          )}

          {!isLoading && result && (
            <div className="results-content">
              {/* Severity & Confidence Summary */}
              <div className="result-summary-card">
                <div className="summary-left">
                  <span className="result-label">AI Predicted Severity Level:</span>
                  <div className="predicted-row">
                    <span className={`severity-badge ${severityInfo?.badgeClass || ''}`}>
                      {result.predicted_class_name}
                    </span>
                    <span className="confidence-pill">
                      {(result.confidence * 100).toFixed(1)}% Confidence
                    </span>
                  </div>
                  <p className="severity-description">{severityInfo?.description}</p>
                </div>
              </div>

              {/* Visualization Views */}
              <div className="visualization-section">
                <div className="view-selector">
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveTab('all')}
                  >
                    Side-by-Side Comparison
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'overlay' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overlay')}
                  >
                    Grad-CAM Overlay
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'heatmap' ? 'active' : ''}`}
                    onClick={() => setActiveTab('heatmap')}
                  >
                    Activation Heatmap
                  </button>
                  <button
                    type="button"
                    className={`tab-btn ${activeTab === 'original' ? 'active' : ''}`}
                    onClick={() => setActiveTab('original')}
                  >
                    Original Fundus
                  </button>
                </div>

                {activeTab === 'all' ? (
                  <div className="image-grid-3">
                    <div className="image-card">
                      <h4>Original Retinal Scan</h4>
                      <img
                        src={previewUrl || ''}
                        alt="Original retinal fundus scan"
                        className="viz-image"
                      />
                      <span className="image-caption">Input fundus image</span>
                    </div>

                    <div className="image-card">
                      <h4>Grad-CAM Heatmap</h4>
                      <img
                        src={result.heatmap_base64}
                        alt="Grad-CAM activation heatmap"
                        className="viz-image"
                      />
                      <span className="image-caption">Jet colormap (Warmer = High attention)</span>
                    </div>

                    <div className="image-card highlighted-card">
                      <h4>Diagnostic Overlay</h4>
                      <img
                        src={result.overlay_base64}
                        alt="Grad-CAM superimposed overlay"
                        className="viz-image"
                      />
                      <span className="image-caption">α = 0.4 Superimposed overlay</span>
                    </div>
                  </div>
                ) : (
                  <div className="single-viz-container">
                    {activeTab === 'overlay' && (
                      <div className="image-card full-view">
                        <h4>Grad-CAM Superimposed Overlay</h4>
                        <img
                          src={result.overlay_base64}
                          alt="Grad-CAM overlay"
                          className="viz-image large"
                        />
                        <p className="image-description">
                          Red and yellow contours indicate fundus regions that most strongly contributed
                          to the <strong>{result.predicted_class_name}</strong> classification.
                        </p>
                      </div>
                    )}
                    {activeTab === 'heatmap' && (
                      <div className="image-card full-view">
                        <h4>Raw Grad-CAM Activation Heatmap</h4>
                        <img
                          src={result.heatmap_base64}
                          alt="Grad-CAM heatmap"
                          className="viz-image large"
                        />
                        <p className="image-description">
                          Computed from pooled gradients at <code>{result.target_layer}</code>.
                        </p>
                      </div>
                    )}
                    {activeTab === 'original' && (
                      <div className="image-card full-view">
                        <h4>Original Retinal Scan</h4>
                        <img
                          src={previewUrl || ''}
                          alt="Original fundus scan"
                          className="viz-image large"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Class Probability Distribution Breakdown */}
              <div className="probabilities-card">
                <h3 className="section-subtitle">Multi-Class Severity Probabilities</h3>
                <div className="prob-bars">
                  {Object.entries(result.probabilities).map(([className, prob]) => {
                    const isPredicted = className === result.predicted_class_name;
                    const pct = (prob * 100).toFixed(1);
                    return (
                      <div key={className} className={`prob-row ${isPredicted ? 'predicted-row-highlight' : ''}`}>
                        <div className="prob-info">
                          <span className="prob-class-name">
                            {className} {isPredicted && '✓ (Predicted)'}
                          </span>
                          <span className="prob-pct">{pct}%</span>
                        </div>
                        <div className="prob-bar-track">
                          <div
                            className={`prob-bar-fill ${isPredicted ? 'fill-predicted' : 'fill-standard'}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Doctor Review & Clinical Assessment Section */}
              <div className="doctor-review-section">
                <div className="doctor-review-header">
                  <div className="doctor-header-left">
                    <span className="doctor-icon">🩺</span>
                    <div>
                      <h3 className="section-subtitle">Clinician / Doctor Review</h3>
                      <p className="doctor-review-subtext">
                        Independent clinician validation. Evaluate the AI prediction and Grad-CAM findings above to finalize clinical assessment.
                      </p>
                    </div>
                  </div>
                  <div className="ai-reference-tag">
                    <span className="ai-ref-label">AI Finding:</span>
                    <strong className="ai-ref-val">
                      {result.predicted_class_name} ({(result.confidence * 100).toFixed(1)}%)
                    </strong>
                  </div>
                </div>

                {doctorReview.confirmed ? (
                  <div className="confirmed-assessment-box">
                    <div className="confirmed-banner">
                      <div className="confirmed-banner-left">
                        <span className="confirmed-check-icon">✓</span>
                        <div>
                          <h4 className="confirmed-title">Final Clinician-Entered Assessment</h4>
                          <p className="confirmed-meta">
                            Authoritative assessment confirmed by Consulting Clinician • {doctorReview.confirmedAt}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-edit-review"
                        onClick={() => setDoctorReview((prev) => ({ ...prev, confirmed: false }))}
                      >
                        Edit Assessment
                      </button>
                    </div>

                    <div className="confirmed-details-grid">
                      <div className="confirmed-field">
                        <span className="field-label">Final Clinician Assessment:</span>
                        <span className="field-value final-stage-badge">
                          {doctorReview.finalAssessment}
                        </span>
                      </div>

                      <div className="confirmed-field">
                        <span className="field-label">Recommended Next Step / Referral:</span>
                        <span className="field-value referral-badge">
                          {doctorReview.recommendedNextStep}
                        </span>
                      </div>

                      <div className="confirmed-field full-width">
                        <span className="field-label">Clinical Notes &amp; Observations:</span>
                        <p className="field-value notes-text">
                          {doctorReview.clinicalNotes || 'No additional clinical notes recorded.'}
                        </p>
                      </div>
                    </div>

                    <div className="clinician-disclaimer-note">
                      <strong>Clinician Confirmation Notice:</strong> This assessment represents the final human clinician evaluation and remains distinct from the AI automated triage finding. No automatic medication prescriptions are generated.
                    </div>
                  </div>
                ) : (
                  <div className="doctor-review-form">
                    <div className="form-group">
                      <label className="form-label" htmlFor="doctor-assessment">
                        1. Doctor's Final Assessment <span className="required-star">*</span>
                      </label>
                      <select
                        id="doctor-assessment"
                        className="form-control"
                        value={doctorReview.finalAssessment}
                        onChange={(e) =>
                          setDoctorReview((prev) => ({ ...prev, finalAssessment: e.target.value }))
                        }
                      >
                        <option value="">-- Select Final Clinician Assessment --</option>
                        <option value="Stage 0: No Diabetic Retinopathy">Stage 0: No Diabetic Retinopathy</option>
                        <option value="Stage 1: Mild Non-Proliferative DR">Stage 1: Mild Non-Proliferative DR</option>
                        <option value="Stage 2: Moderate Non-Proliferative DR">Stage 2: Moderate Non-Proliferative DR</option>
                        <option value="Stage 3: Severe Non-Proliferative DR">Stage 3: Severe Non-Proliferative DR</option>
                        <option value="Stage 4: Proliferative DR">Stage 4: Proliferative DR</option>
                        <option value="Inconclusive / Ungradable Quality Scan">Inconclusive / Ungradable Quality Scan</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="clinical-notes">
                        2. Clinical Notes &amp; Observations
                      </label>
                      <textarea
                        id="clinical-notes"
                        className="form-control textarea"
                        rows={3}
                        placeholder="Document observations (e.g., microaneurysms in macula, hard exudates, cotton wool spots, media haze)..."
                        value={doctorReview.clinicalNotes}
                        onChange={(e) =>
                          setDoctorReview((prev) => ({ ...prev, clinicalNotes: e.target.value }))
                        }
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="referral-action">
                        3. Recommended Next Step / Referral <span className="required-star">*</span>
                      </label>
                      <select
                        id="referral-action"
                        className="form-control"
                        value={doctorReview.recommendedNextStep}
                        onChange={(e) =>
                          setDoctorReview((prev) => ({ ...prev, recommendedNextStep: e.target.value }))
                        }
                      >
                        <option value="">-- Select Recommended Clinical Action / Referral --</option>
                        <option value="Routine annual re-screening (12 months)">Routine annual re-screening (12 months)</option>
                        <option value="Follow-up screening in 3–6 months">Follow-up screening in 3–6 months</option>
                        <option value="Referral to Optometrist / Primary Eye Care">Referral to Optometrist / Primary Eye Care</option>
                        <option value="Urgent referral to Vitreoretinal Specialist">Urgent referral to Vitreoretinal Specialist</option>
                        <option value="Emergency intervention / Tertiary Eye Hospital referral">Emergency intervention / Tertiary Eye Hospital referral</option>
                        <option value="Repeat fundus photography (poor image quality)">Repeat fundus photography (poor image quality)</option>
                      </select>
                    </div>

                    <div className="doctor-review-actions">
                      <button
                        type="button"
                        className="btn btn-confirm-assessment"
                        disabled={!doctorReview.finalAssessment || !doctorReview.recommendedNextStep}
                        onClick={() => {
                          setDoctorReview((prev) => ({
                            ...prev,
                            confirmed: true,
                            confirmedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString(),
                          }));
                        }}
                      >
                        Confirm Assessment
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Doctor-Entered Clinical Plan — shown only after doctor review is confirmed */}
              {doctorReview.confirmed && (
                <div className="clinical-plan-section">
                  <div className="clinical-plan-header">
                    <div className="clinical-plan-header-left">
                      <span className="clinical-plan-icon">📋</span>
                      <div>
                        <h3 className="section-subtitle">Doctor-Entered Clinical Plan</h3>
                        <p className="clinical-plan-subtext">
                          All treatment fields must be explicitly entered by the consulting clinician.
                          The AI does not generate or suggest medication.
                        </p>
                      </div>
                    </div>
                    <div className="clinician-assessment-ref">
                      <span className="ai-ref-label">Based On Assessment:</span>
                      <strong className="ai-ref-val">{doctorReview.finalAssessment}</strong>
                    </div>
                  </div>

                  {clinicalPlan.saved ? (
                    <div className="saved-plan-box">
                      <div className="saved-plan-banner">
                        <div className="confirmed-banner-left">
                          <span className="confirmed-check-icon">✓</span>
                          <div>
                            <h4 className="confirmed-title">Doctor-Entered Clinical Plan</h4>
                            <p className="confirmed-meta">
                              Clinician-entered plan saved • {clinicalPlan.savedAt}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-edit-review"
                          onClick={() => setClinicalPlan((prev) => ({ ...prev, saved: false }))}
                        >
                          Edit Plan
                        </button>
                      </div>

                      <div className="saved-plan-grid">
                        <div className="confirmed-field">
                          <span className="field-label">Treatment / Medication:</span>
                          <p className="field-value notes-text">{clinicalPlan.treatment}</p>
                        </div>
                        <div className="confirmed-field">
                          <span className="field-label">Dosage &amp; Frequency:</span>
                          <p className="field-value notes-text">{clinicalPlan.dosageFrequency}</p>
                        </div>
                        <div className="confirmed-field">
                          <span className="field-label">Duration:</span>
                          <p className="field-value notes-text">{clinicalPlan.duration}</p>
                        </div>
                        <div className="confirmed-field">
                          <span className="field-label">Follow-up Date:</span>
                          <p className="field-value notes-text">{clinicalPlan.followUpDate || 'Not specified'}</p>
                        </div>
                        {clinicalPlan.clinicalInstructions && (
                          <div className="confirmed-field full-width">
                            <span className="field-label">Clinical Instructions:</span>
                            <p className="field-value notes-text">{clinicalPlan.clinicalInstructions}</p>
                          </div>
                        )}
                      </div>

                      <div className="clinician-disclaimer-note">
                        <strong>Clinician Notice:</strong> This clinical plan has been entered and confirmed by the consulting clinician.
                        It is not automatically generated by the AI system. No medication has been automatically prescribed.
                      </div>
                    </div>
                  ) : (
                    <div className="clinical-plan-form">
                      <div className="cp-form-grid">
                        <div className="form-group">
                          <label className="form-label" htmlFor="cp-treatment">
                            1. Treatment / Medication <span className="required-star">*</span>
                          </label>
                          <textarea
                            id="cp-treatment"
                            className="form-control textarea"
                            rows={2}
                            placeholder="e.g., Intravitreal Anti-VEGF injection (Ranibizumab), Pan-retinal photocoagulation..."
                            value={clinicalPlan.treatment}
                            onChange={(e) => setClinicalPlan((prev) => ({ ...prev, treatment: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="cp-dosage">
                            2. Dosage &amp; Frequency <span className="required-star">*</span>
                          </label>
                          <input
                            id="cp-dosage"
                            type="text"
                            className="form-control"
                            placeholder="e.g., 0.5mg monthly for 3 months, then PRN..."
                            value={clinicalPlan.dosageFrequency}
                            onChange={(e) => setClinicalPlan((prev) => ({ ...prev, dosageFrequency: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="cp-duration">
                            3. Duration <span className="required-star">*</span>
                          </label>
                          <input
                            id="cp-duration"
                            type="text"
                            className="form-control"
                            placeholder="e.g., 3 months, 6 months, ongoing..."
                            value={clinicalPlan.duration}
                            onChange={(e) => setClinicalPlan((prev) => ({ ...prev, duration: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label" htmlFor="cp-followup">
                            4. Follow-up Date
                          </label>
                          <input
                            id="cp-followup"
                            type="date"
                            className="form-control"
                            value={clinicalPlan.followUpDate}
                            onChange={(e) => setClinicalPlan((prev) => ({ ...prev, followUpDate: e.target.value }))}
                          />
                        </div>

                        <div className="form-group full-span">
                          <label className="form-label" htmlFor="cp-instructions">
                            5. Clinical Instructions
                          </label>
                          <textarea
                            id="cp-instructions"
                            className="form-control textarea"
                            rows={3}
                            placeholder="e.g., Strict glycaemic control (HbA1c < 7%), blood pressure monitoring, patient education on DR..."
                            value={clinicalPlan.clinicalInstructions}
                            onChange={(e) => setClinicalPlan((prev) => ({ ...prev, clinicalInstructions: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="ai-no-prescription-notice">
                        ⚠️ <strong>Important:</strong> The AI system does not automatically prescribe or recommend any medication.
                        All fields above must be explicitly entered by the consulting clinician.
                      </div>

                      <div className="doctor-review-actions">
                        <button
                          type="button"
                          className="btn btn-save-plan"
                          disabled={!clinicalPlan.treatment || !clinicalPlan.dosageFrequency || !clinicalPlan.duration}
                          onClick={() => {
                            setClinicalPlan((prev) => ({
                              ...prev,
                              saved: true,
                              savedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + new Date().toLocaleDateString(),
                            }));
                          }}
                        >
                          Save Clinical Plan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Patient-Friendly Explanation — shown only after doctor has confirmed assessment AND saved clinical plan */}
              {doctorReview.confirmed && clinicalPlan.saved && (
                <div className="patient-explanation-section">
                  <div className="patient-explanation-header">
                    <div className="patient-header-left">
                      <span className="patient-icon">📖</span>
                      <div>
                        <h3 className="section-subtitle">{t.patientGuideTitle}</h3>
                        <p className="patient-subtext">{t.patientGuideSubtitle}</p>
                      </div>
                    </div>
                    <div className="patient-header-right">
                      <div className="patient-lang-pill-group" role="group" aria-label="Language selection / भाषा चुनें">
                        <button
                          type="button"
                          className={`patient-lang-pill ${language === 'en' ? 'active' : ''}`}
                          onClick={() => setLanguage('en')}
                          aria-pressed={language === 'en'}
                        >
                          English
                        </button>
                        <button
                          type="button"
                          className={`patient-lang-pill ${language === 'hi' ? 'active' : ''}`}
                          onClick={() => setLanguage('hi')}
                          aria-pressed={language === 'hi'}
                        >
                          हिंदी
                        </button>
                      </div>
                      <span className="badge-patient-guide">{t.patientBadge}</span>
                    </div>
                  </div>

                  {/* Required Notice Banner */}
                  <div className="patient-disclaimer-banner" role="alert">
                    <span className="patient-disclaimer-icon">ℹ️</span>
                    <div className="patient-disclaimer-text">
                      <strong>{t.patientDisclaimer}</strong>
                    </div>
                  </div>

                  {/* Section 1: The Condition in Simple Words */}
                  <div className="patient-card condition-card">
                    <div className="patient-card-header">
                      <span className="card-badge-num">1</span>
                      <h4>{t.conditionTitle}</h4>
                    </div>
                    <div className="patient-card-body">
                      <div className="patient-field">
                        <span className="patient-field-label">{t.confirmedAssessmentLabel}</span>
                        <span className="patient-doctor-assessment-badge">
                          {doctorReview.finalAssessment || t.notProvided}
                        </span>
                      </div>

                      <div className="patient-field">
                        <span className="patient-field-label">{t.whatThisMeansLabel}</span>
                        <p className="patient-explanation-text">
                          {patientContent?.meaning ||
                            (language === 'hi'
                              ? 'डॉक्टर ने आपकी रेटिना तस्वीर का परीक्षण करके ऊपर दिया गया निष्कर्ष दर्ज किया है।'
                              : 'The clinician has examined your retinal photo and recorded the assessment above.')}
                        </p>
                      </div>

                      <div className="patient-field">
                        <span className="patient-field-label">{t.generalAdviceLabel}</span>
                        <p className="patient-advice-text">
                          {patientContent?.advice ||
                            (language === 'hi'
                              ? 'कृपया नीचे दी गई डॉक्टर की सलाह का पालन करें और नियमित जांच कराएं।'
                              : 'Follow the clinician-prescribed plan below and attend all recommended checkups.')}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Doctor-Entered Treatment Plan (Exact Preservation) */}
                  <div className="patient-card treatment-card">
                    <div className="patient-card-header">
                      <span className="card-badge-num">2</span>
                      <h4>{t.treatmentTitle}</h4>
                    </div>
                    <p className="treatment-safety-subtext">
                      {t.treatmentSafetyNote}
                    </p>

                    <div className="patient-treatment-grid">
                      <div className="patient-info-box">
                        <span className="info-box-label">{t.treatmentLabel}</span>
                        <p className="info-box-val">
                          {clinicalPlan.treatment.trim() || t.notProvided}
                        </p>
                      </div>

                      <div className="patient-info-box">
                        <span className="info-box-label">{t.dosageLabel}</span>
                        <p className="info-box-val">
                          {clinicalPlan.dosageFrequency.trim() || t.notProvided}
                        </p>
                      </div>

                      <div className="patient-info-box">
                        <span className="info-box-label">{t.durationLabel}</span>
                        <p className="info-box-val">
                          {clinicalPlan.duration.trim() || t.notProvided}
                        </p>
                      </div>

                      <div className="patient-info-box">
                        <span className="info-box-label">{t.followUpDateLabel}</span>
                        <p className="info-box-val highlight-date">
                          {clinicalPlan.followUpDate.trim() || t.notProvided}
                        </p>
                      </div>

                      <div className="patient-info-box full-span">
                        <span className="info-box-label">{t.instructionsLabel}</span>
                        <p className="info-box-val">
                          {clinicalPlan.clinicalInstructions.trim() || t.notProvided}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Essential Tips for Rural Patients with Diabetes */}
                  <div className="patient-card rural-tips-card">
                    <div className="patient-card-header">
                      <span className="card-badge-num">3</span>
                      <h4>{t.tipsTitle}</h4>
                    </div>
                    <ul className="patient-tips-list">
                      <li>{t.tip1}</li>
                      <li>{t.tip2}</li>
                      <li>{t.tip3}</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Follow-up / Reminder Section — shown only after doctor has confirmed assessment AND saved clinical plan */}
              {doctorReview.confirmed && clinicalPlan.saved && (
                <div className="followup-reminder-section">
                  <div className="followup-header">
                    <div className="followup-header-left">
                      <span className="followup-icon">🔔</span>
                      <div>
                        <h3 className="section-subtitle">{t.reminderTitle}</h3>
                        <p className="followup-subtext">{t.reminderSubtitle}</p>
                      </div>
                    </div>
                    <div className="followup-badge-container">
                      <span className={`status-pill ${followUpInfo.badgeClass}`}>
                        {language === 'hi' ? followUpInfo.statusHi : followUpInfo.statusEn}
                      </span>
                    </div>
                  </div>

                  {/* Required Notice */}
                  <div className="reminder-notice-banner" role="alert">
                    <span className="reminder-notice-icon">⚠️</span>
                    <div className="reminder-notice-text">
                      <strong>{t.reminderNotice}</strong>
                    </div>
                  </div>

                  {/* Reminder Details Card */}
                  <div className="reminder-card">
                    <div className="reminder-grid">
                      <div className="reminder-field">
                        <span className="reminder-field-label">{t.nextVisitLabel}</span>
                        <span className="reminder-date-badge">
                          📅 {followUpInfo.formattedDate}
                        </span>
                      </div>

                      <div className="reminder-field">
                        <span className="reminder-field-label">{t.statusLabel}</span>
                        <span className={`reminder-status-badge ${followUpInfo.badgeClass}`}>
                          {language === 'hi' ? followUpInfo.statusHi : followUpInfo.statusEn}
                        </span>
                      </div>

                      <div className="reminder-field full-width">
                        <span className="reminder-field-label">{t.messageLabel}</span>
                        <div className="reminder-message-box">
                          <p className="reminder-msg-en">
                            {language === 'hi' ? followUpInfo.messageHi : followUpInfo.messageEn}
                          </p>
                          <p className="reminder-msg-hi">
                            {language === 'hi' ? followUpInfo.messageEn : followUpInfo.messageHi}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Acknowledge Button & Status */}
                    <div className="reminder-actions-row">
                      {reminderAcknowledged ? (
                        <div className="ack-confirmed-box">
                          <div className="ack-banner-left">
                            <span className="ack-check-icon">✓</span>
                            <div>
                              <strong>{t.ackTitle}</strong>
                              <p className="ack-meta">
                                {t.ackMetaPrefix} {reminderAcknowledgedAt}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-edit-ack"
                            onClick={() => {
                              setReminderAcknowledged(false);
                              setReminderAcknowledgedAt(null);
                            }}
                          >
                            {t.editAckBtn}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-ack-reminder"
                          onClick={() => {
                            setReminderAcknowledged(true);
                            setReminderAcknowledgedAt(
                              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
                                ', ' +
                                new Date().toLocaleDateString('en-IN')
                            );
                          }}
                        >
                          {t.ackBtn}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

              )}
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="footer">
        <p>
          <strong>VisionNexa</strong> — Explainable AI Retinal Screening for Rural Healthcare
        </p>
        <p className="footer-subtext">
          Targeted for rural primary health centres (PHCs) &amp; vision centres. Powered by PyTorch &amp; FastAPI.
        </p>
      </footer>
    </div>
  );
}
