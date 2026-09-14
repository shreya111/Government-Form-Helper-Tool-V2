import { useState, useCallback, useRef } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { FileText, Download, ArrowLeft, Sparkles, Info } from "lucide-react";
import { HelperPanel } from "../panel/HelperPanel";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;
const LOGO = "/formwise-logo.png";

const SECTIONS = [
  {
    title: "Applicant Details",
    subtitle: "Personal information",
    fields: [
      { label: "Given Name (First & Middle Name)", name: "given_name", placeholder: "Enter your first and middle name", helpText: "As printed on documents" },
      { label: "Surname (Last Name)", name: "surname", placeholder: "Enter your surname" },
      { label: "Date of Birth", name: "dob", type: "date" },
      { label: "Gender", name: "gender", type: "select", options: [
        { value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "transgender", label: "Transgender" }] },
      { label: "Place of Birth", name: "birth_place", placeholder: "City/Town/Village" },
      { label: "Marital Status", name: "marital_status", type: "select", options: [
        { value: "single", label: "Single / Unmarried" }, { value: "married", label: "Married" },
        { value: "divorced", label: "Divorced" }, { value: "widowed", label: "Widow / Widower" }] },
    ],
  },
  {
    title: "Education & Employment",
    subtitle: "Qualification details",
    fields: [
      { label: "Educational Qualification", name: "education", type: "select", options: [
        { value: "below_10th", label: "Below 10th Standard" }, { value: "10th", label: "10th Pass" },
        { value: "12th", label: "12th Pass / Higher Secondary" }, { value: "graduate", label: "Graduate" },
        { value: "post_graduate", label: "Post Graduate" }] },
      { label: "Employment Type", name: "employment", type: "select", options: [
        { value: "government", label: "Government Employee" }, { value: "private", label: "Private Sector" },
        { value: "self_employed", label: "Self Employed" }, { value: "student", label: "Student" }, { value: "retired", label: "Retired" }] },
      { label: "ECR / ECNR Status", name: "ecr_status", type: "select", helpText: "Important for international travel", options: [
        { value: "ecr", label: "ECR - Emigration Check Required" }, { value: "ecnr", label: "ECNR - Emigration Check Not Required" }] },
    ],
  },
  {
    title: "Present Address",
    subtitle: "Current residential address",
    fields: [
      { label: "House No. & Street", name: "street", placeholder: "Enter address" },
      { label: "City / Town", name: "city", placeholder: "Enter city" },
      { label: "State", name: "state", placeholder: "Enter state" },
      { label: "PIN Code", name: "pincode", placeholder: "6-digit PIN" },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields.map((f) => ({ ...f, section: s.title })));

const inputClass = (isActive) =>
  `w-full bg-white/5 backdrop-blur-sm border rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none transition-colors ${
    isActive ? "border-emerald-500/50 ring-2 ring-emerald-500/20 bg-emerald-500/5" : "border-white/10 hover:border-white/20"
  }`;

const FormField = ({ field, value, isActive, onFocus, onChange }) => {
  const { label, name, type = "text", placeholder, options, helpText } = field;
  const common = {
    name,
    value,
    onChange: (e) => onChange(name, e.target.value),
    onFocus: () => onFocus(field),
    className: inputClass(isActive),
  };
  return (
    <div className="mb-5" data-testid={`form-field-${name}`}>
      <label className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2 flex items-center gap-2">
        {label}
        <span className="text-amber-400">*</span>
      </label>
      {helpText && (
        <p className="text-xs text-white/40 mb-2 flex items-center gap-1">
          <Info className="w-3 h-3" />
          {helpText}
        </p>
      )}
      {type === "select" ? (
        <select {...common} className={`${common.className} cursor-pointer`} data-testid={`select-${name}`}>
          <option value="" className="bg-slate-800">Select an option...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-800">{opt.label}</option>
          ))}
        </select>
      ) : (
        <input type={type} placeholder={placeholder} {...common} data-testid={`input-${name}`} />
      )}
    </div>
  );
};

const SectionHeader = ({ title, subtitle }) => (
  <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
    <div className="bg-gradient-to-br from-blue-500 to-emerald-500 p-2 rounded-xl">
      <FileText className="w-5 h-5 text-white" />
    </div>
    <div>
      <h3 className="text-base font-bold text-white">{title}</h3>
      {subtitle && <p className="text-xs text-white/50">{subtitle}</p>}
    </div>
  </div>
);

const FormSimulator = () => {
  const [activeField, setActiveField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState(null);
  const [isPanelVisible, setIsPanelVisible] = useState(false);
  const [error, setError] = useState(null);
  const [values, setValues] = useState({});
  const [chatMessages, setChatMessages] = useState([]);
  const lastRequestedField = useRef(null);
  const debounceTimer = useRef(null);

  const handleFieldFocus = useCallback((field) => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      setActiveField(field);
      setIsPanelVisible(true);
      setError(null);
      if (lastRequestedField.current === field.name) return;

      setIsLoading(true);
      setAiResponse(null);
      lastRequestedField.current = field.name;
      try {
        const response = await axios.post(`${API}/form-help`, {
          field_label: field.label,
          field_type: field.type === "select" ? "select" : "input",
          field_options: (field.options || []).map((o) => o.label).join(", "),
          section_context: field.section,
          help_text: field.helpText || "",
          form_context: "Indian Passport Application Form",
        });
        setAiResponse(response.data);
      } catch (err) {
        console.error("Error fetching form help:", err);
        setError("Unable to fetch guidance. Please try again.");
        lastRequestedField.current = null;
      } finally {
        setIsLoading(false);
      }
    }, 300);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelVisible(false);
    setActiveField(null);
    setAiResponse(null);
    lastRequestedField.current = null;
  }, []);

  const handleChange = (name, value) => setValues((v) => ({ ...v, [name]: value }));

  const sendChat = async (message, history) => {
    const resp = await axios.post(`${API}/chat`, {
      message,
      page_context: {
        page_title: document.title,
        page_url: window.location.href,
        page_text: document.body.innerText.substring(0, 8000),
        form_data: values,
      },
      chat_history: history,
    });
    return resp.data.response;
  };

  const jumpToField = (name) => {
    const el = document.querySelector(`[name="${name}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => el.focus({ preventScroll: true }), 250);
  };

  const missing = ALL_FIELDS.filter((f) => !values[f.name]);
  const progress = {
    total: ALL_FIELDS.length,
    completed: ALL_FIELDS.length - missing.length,
    missing: missing.map((f) => ({ id: f.name, label: f.label, section: f.section })),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" data-testid="form-simulator">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-[120px]" />
      </div>

      <header className="relative bg-slate-900/80 backdrop-blur-xl border-b border-white/10 py-4 px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors" data-testid="back-link">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm">Back</span>
            </Link>
            <div className="h-6 w-px bg-white/10" />
            <div className="flex items-center gap-3">
              <img src={LOGO} alt="FormWise Logo" className="w-11 h-11 object-contain" />
              <div>
                <h1 className="text-lg font-bold">FormWise Demo</h1>
                <p className="text-xs text-white/50">Try the AI assistant</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/mock-passport.html"
              className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-full text-sm text-white/80 hover:bg-white/10 transition-colors"
              data-testid="mock-page-link"
            >
              <FileText className="w-4 h-4" />
              <span>Mock Passport Page</span>
            </a>
            <a
              href={`${API}/extension/download`}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-emerald-500 px-5 py-2.5 rounded-full text-sm font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-shadow"
              data-testid="download-extension-btn"
            >
              <Download className="w-4 h-4" />
              <span>Download Extension</span>
            </a>
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8">
          <div className="flex items-start gap-4">
            <div className="bg-gradient-to-br from-blue-500/20 to-emerald-500/20 p-3 rounded-xl">
              <Sparkles className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white mb-1">Interactive Demo</h2>
              <p className="text-sm text-white/60">
                Click on any form field below to see the AI assistant in action.
                <span className="text-emerald-400"> Track required fields</span> in the panel and
                <span className="text-blue-400"> get AI guidance</span> for every question.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-6">
          <div className={`transition-[width] duration-300 ${isPanelVisible ? "w-full lg:w-[calc(100%-440px)]" : "w-full"}`}>
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden">
              <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-5 border-b border-white/10 flex items-center gap-3">
                <FileText className="w-7 h-7 text-white/80" />
                <div>
                  <h2 className="text-lg font-bold text-white">Passport Application Form</h2>
                  <p className="text-sm text-white/50">Sample form based on Passport Seva portal</p>
                </div>
              </div>

              <div className="p-6">
                {SECTIONS.map((section) => (
                  <section key={section.title} className="mb-8 last:mb-0">
                    <SectionHeader title={section.title} subtitle={section.subtitle} />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                      {section.fields.map((field) => (
                        <FormField
                          key={field.name}
                          field={{ ...field, section: section.title }}
                          value={values[field.name] || ""}
                          isActive={activeField?.name === field.name}
                          onFocus={handleFieldFocus}
                          onChange={handleChange}
                        />
                      ))}
                    </div>
                  </section>
                ))}

                <div className="mt-8 pt-6 border-t border-white/10 flex justify-end gap-4">
                  <button className="px-6 py-3 bg-white/5 border border-white/10 rounded-xl text-white/70 hover:bg-white/10 transition-colors" data-testid="save-draft-btn">
                    Save Draft
                  </button>
                  <button className="px-6 py-3 bg-gradient-to-r from-blue-500 to-emerald-500 rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-shadow" data-testid="submit-btn">
                    Submit Application
                  </button>
                </div>
              </div>
            </div>
          </div>

          {isPanelVisible && (
            <HelperPanel
              logoSrc={LOGO}
              activeField={activeField?.label || null}
              activeSection={activeField?.section || null}
              isLoading={isLoading}
              response={aiResponse}
              error={error}
              progress={progress}
              fieldOptions={activeField?.options}
              onApply={(value) => activeField && handleChange(activeField.name, value)}
              chatMessages={chatMessages}
              onChatMessagesChange={setChatMessages}
              onSendChat={sendChat}
              onClose={handleClosePanel}
              onJumpToField={jumpToField}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default FormSimulator;
