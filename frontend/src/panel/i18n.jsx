import { createContext, useCallback, useContext, useMemo, useState } from "react";

const LANG_KEY = "fw_lang";

const STRINGS = {
  en: {
    "tab.field-help": "Field Help", "tab.documents": "Documents", "tab.chat": "Chat",
    "header.subtitle": "AI-Powered Assistance", "footer.note": "AI-powered guidance",
    "lang.switch": "Switch language",
    "signin.title": "Sign in to continue",
    "signin.body": "Sign in with Google so FormWise can securely process your documents and remember them only for you.",
    "signin.button": "Sign in with Google",
    "signin.waiting": "Waiting for sign-in…",
    "signin.waiting.body": "Complete sign-in in the tab that just opened, then come back here.",
    "signin.done": "I've signed in", "common.cancel": "Cancel",
    "signin.nudge": "Sign in to upload these and autofill the form",
    "consent.title": "Your documents contain personal information",
    "consent.body": "FormWise uses uploaded documents only to identify information relevant to this form. You control what gets used, and your documents are temporary unless you choose to save them.",
    "consent.note": "Do not upload documents you do not want processed.",
    "consent.continue": "Continue",
    "review.back": "Back to documents", "review.ready": "Ready to autofill",
    "review.summary": "FormWise found information for {suggested} of {total} fields.",
    "review.missing": "{missing} need your input.",
    "review.source": "Source: {doc}",
    "review.mismatch": "Different values found — please verify",
    "review.apply": "Autofill {n} approved fields",
    "review.note": "These fields will be populated using information you approved.",
    "conflict.title": "Resolve mismatches",
    "conflict.body": "{n} fields have different values across your documents. Pick the right one.",
    "conflict.use": "Use this", "conflict.resolved": "Resolved",
    "conflict.pick": "Pick a value to include this field",
    "list.title": "Your documents", "list.signout": "Sign out",
    "result.filled": "{n} fields populated", "result.needed": "{n} fields still need your attention",
    "drop.title": "Drag & drop or click to upload", "drop.sub": "PDF, JPG or PNG",
    "empty.title": "No documents yet",
    "empty.sub": "Upload your supporting documents and FormWise can help fill the form using information found in them.",
    "list.review": "Review & Autofill",
    "status.reading": "Reading…", "status.ready": "Ready", "status.failed": "Failed",
    "conf.high": "High", "conf.medium": "Medium", "conf.low": "Low",
    "req.title": "Documents that help this form",
    "req.recommended": "Recommended", "req.optional": "Optional",
    "req.uploaded": "Uploaded", "req.missing": "Not uploaded",
    "error.upload": "We couldn't upload this document. Please try again.",
    "error.preview": "Couldn't prepare autofill. Please try again.",
    "error.nofields": "No form fields were detected on this page.",
    "unavailable.title": "Document Autofill",
    "unavailable.sub": "Open the FormWise web demo to upload your documents and autofill this form.",
    "doc.AADHAAR": "Aadhaar", "doc.PAN": "PAN Card", "doc.BIRTH_CERTIFICATE": "Birth Certificate",
    "doc.DRIVING_LICENCE": "Driving Licence", "doc.VOTER_ID": "Voter ID", "doc.PASSPORT": "Passport",
    "doc.CLASS_10_CERTIFICATE": "Class 10 Certificate", "doc.ADDRESS_PROOF": "Address Proof",
    "doc.UTILITY_BILL": "Utility Bill", "doc.OTHER": "Other Document", "doc.UNKNOWN": "Unrecognised",
    "doc.DEFAULT": "Document",
    "help.question": "Question", "help.which": "Which applies to you?", "help.select": "Select This",
    "help.applied": "Applied to form", "help.apply": "Apply \"{label}\"", "help.analyzing": "Analyzing question...",
    "help.errorTitle": "Something went wrong", "help.advice": "Expert Advice", "help.important": "Important",
    "help.readyTitle": "Ready to Help!", "help.readySub": "Click on any form field to get guidance.",
    "chat.title": "Ask Me Anything!",
    "chat.sub": "I can help you with questions about this form, required documents, eligibility, or any confusing terms.",
    "chat.thinking": "Thinking...", "chat.placeholder": "Ask about the form...",
    "chat.error": "Unable to get response. Please try again.",
    "hint.title": "What to upload next",
    "hint.doc": "Upload {doc} to fill {n} more fields", "hint.docOne": "Upload {doc} to fill 1 more field",
    "hint.field": "Upload your {doc} and FormWise can fill this for you.", "hint.open": "Open Documents",
  },
  hi: {
    "tab.field-help": "फ़ील्ड सहायता", "tab.documents": "दस्तावेज़", "tab.chat": "चैट",
    "header.subtitle": "AI-संचालित सहायता", "footer.note": "AI-संचालित मार्गदर्शन",
    "lang.switch": "भाषा बदलें",
    "signin.title": "जारी रखने के लिए साइन इन करें",
    "signin.body": "Google से साइन इन करें ताकि FormWise आपके दस्तावेज़ सुरक्षित रूप से पढ़ सके और उन्हें केवल आपके लिए याद रखे।",
    "signin.button": "Google से साइन इन करें",
    "signin.waiting": "साइन इन की प्रतीक्षा…",
    "signin.waiting.body": "अभी खुले नए टैब में साइन इन पूरा करें, फिर यहाँ वापस आएँ।",
    "signin.done": "मैंने साइन इन कर लिया", "common.cancel": "रद्द करें",
    "signin.nudge": "इन्हें अपलोड करने और फ़ॉर्म ऑटोफ़िल करने के लिए साइन इन करें",
    "consent.title": "आपके दस्तावेज़ों में व्यक्तिगत जानकारी होती है",
    "consent.body": "FormWise अपलोड किए गए दस्तावेज़ों का उपयोग केवल इस फ़ॉर्म से जुड़ी जानकारी पहचानने के लिए करता है। क्या उपयोग होगा, यह आप तय करते हैं, और आपके दस्तावेज़ अस्थायी हैं जब तक आप उन्हें सहेजना न चुनें।",
    "consent.note": "ऐसे दस्तावेज़ अपलोड न करें जिन्हें आप प्रोसेस नहीं करवाना चाहते।",
    "consent.continue": "जारी रखें",
    "review.back": "दस्तावेज़ों पर वापस जाएँ", "review.ready": "ऑटोफ़िल के लिए तैयार",
    "review.summary": "FormWise को {total} में से {suggested} फ़ील्ड की जानकारी मिली।",
    "review.missing": "{missing} फ़ील्ड में आपकी जानकारी चाहिए।",
    "review.source": "स्रोत: {doc}",
    "review.mismatch": "अलग-अलग मान मिले — कृपया जाँचें",
    "review.apply": "{n} स्वीकृत फ़ील्ड ऑटोफ़िल करें",
    "review.note": "ये फ़ील्ड आपकी स्वीकृत जानकारी से भरे जाएँगे।",
    "conflict.title": "बेमेल मान सुलझाएँ",
    "conflict.body": "{n} फ़ील्ड के मान आपके दस्तावेज़ों में अलग-अलग हैं। सही मान चुनें।",
    "conflict.use": "यह चुनें", "conflict.resolved": "सुलझ गया",
    "conflict.pick": "इस फ़ील्ड को शामिल करने के लिए एक मान चुनें",
    "list.title": "आपके दस्तावेज़", "list.signout": "साइन आउट",
    "result.filled": "{n} फ़ील्ड भर दिए गए", "result.needed": "{n} फ़ील्ड पर अभी भी आपका ध्यान चाहिए",
    "drop.title": "अपलोड करने के लिए खींचें-छोड़ें या क्लिक करें", "drop.sub": "PDF, JPG या PNG",
    "empty.title": "अभी कोई दस्तावेज़ नहीं",
    "empty.sub": "अपने सहायक दस्तावेज़ अपलोड करें और FormWise उनमें मिली जानकारी से फ़ॉर्म भरने में मदद करेगा।",
    "list.review": "समीक्षा करें और ऑटोफ़िल करें",
    "status.reading": "पढ़ा जा रहा है…", "status.ready": "तैयार", "status.failed": "विफल",
    "conf.high": "उच्च", "conf.medium": "मध्यम", "conf.low": "कम",
    "req.title": "इस फ़ॉर्म में मदद करने वाले दस्तावेज़",
    "req.recommended": "अनुशंसित", "req.optional": "वैकल्पिक",
    "req.uploaded": "अपलोड हो गया", "req.missing": "अपलोड नहीं हुआ",
    "error.upload": "हम यह दस्तावेज़ अपलोड नहीं कर सके। कृपया पुनः प्रयास करें।",
    "error.preview": "ऑटोफ़िल तैयार नहीं हो सका। कृपया पुनः प्रयास करें।",
    "error.nofields": "इस पेज पर कोई फ़ॉर्म फ़ील्ड नहीं मिला।",
    "unavailable.title": "दस्तावेज़ ऑटोफ़िल",
    "unavailable.sub": "अपने दस्तावेज़ अपलोड करने और यह फ़ॉर्म ऑटोफ़िल करने के लिए FormWise वेब डेमो खोलें।",
    "doc.AADHAAR": "आधार", "doc.PAN": "पैन कार्ड", "doc.BIRTH_CERTIFICATE": "जन्म प्रमाण पत्र",
    "doc.DRIVING_LICENCE": "ड्राइविंग लाइसेंस", "doc.VOTER_ID": "वोटर आईडी", "doc.PASSPORT": "पासपोर्ट",
    "doc.CLASS_10_CERTIFICATE": "कक्षा 10 प्रमाण पत्र", "doc.ADDRESS_PROOF": "पते का प्रमाण",
    "doc.UTILITY_BILL": "यूटिलिटी बिल", "doc.OTHER": "अन्य दस्तावेज़", "doc.UNKNOWN": "अज्ञात",
    "doc.DEFAULT": "दस्तावेज़",
    "help.question": "प्रश्न", "help.which": "आप पर क्या लागू होता है?", "help.select": "यह चुनें",
    "help.applied": "फ़ॉर्म में लागू हो गया", "help.apply": "\"{label}\" लागू करें", "help.analyzing": "प्रश्न का विश्लेषण हो रहा है...",
    "help.errorTitle": "कुछ गड़बड़ हो गई", "help.advice": "विशेषज्ञ सलाह", "help.important": "महत्वपूर्ण",
    "help.readyTitle": "मदद के लिए तैयार!", "help.readySub": "मार्गदर्शन पाने के लिए किसी भी फ़ॉर्म फ़ील्ड पर क्लिक करें।",
    "chat.title": "कुछ भी पूछें!",
    "chat.sub": "मैं इस फ़ॉर्म, ज़रूरी दस्तावेज़ों, पात्रता या किसी भी उलझन वाले शब्द के बारे में आपकी मदद कर सकता हूँ।",
    "chat.thinking": "सोच रहा हूँ...", "chat.placeholder": "फ़ॉर्म के बारे में पूछें...",
    "chat.error": "उत्तर नहीं मिल सका। कृपया पुनः प्रयास करें।",
    "hint.title": "आगे क्या अपलोड करें",
    "hint.doc": "{n} और फ़ील्ड भरने के लिए {doc} अपलोड करें", "hint.docOne": "1 और फ़ील्ड भरने के लिए {doc} अपलोड करें",
    "hint.field": "अपना {doc} अपलोड करें और FormWise इसे आपके लिए भर सकता है।", "hint.open": "दस्तावेज़ खोलें",
  },
};

export const readLang = () => {
  try { return localStorage.getItem(LANG_KEY) === "hi" ? "hi" : "en"; } catch { return "en"; }
};

const LangContext = createContext({ lang: "en", setLang: () => {}, t: (k) => k });

export const LangProvider = ({ children, onChange }) => {
  const [lang, setLangState] = useState(readLang);
  const setLang = useCallback((l) => {
    setLangState(l);
    try { localStorage.setItem(LANG_KEY, l); } catch { /* ignore */ }
    onChange?.(l);
  }, [onChange]);
  const t = useCallback((key, vars) => {
    let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
    if (vars) Object.entries(vars).forEach(([k, v]) => { s = s.replace(`{${k}}`, v); });
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
};

export const useT = () => useContext(LangContext);

// Localised document-type label; falls back to a generic "Document".
export const docLabel = (t, type) => (type && STRINGS.en[`doc.${type}`] ? t(`doc.${type}`) : t("doc.DEFAULT"));
