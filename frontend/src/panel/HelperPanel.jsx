import { useEffect, useState } from "react";
import { LangProvider, useT } from "./i18n";
import { PanelHeader } from "./PanelHeader";
import { PanelTabs } from "./PanelTabs";
import { ProgressBar } from "./ProgressBar";
import { FieldHelpTab } from "./FieldHelpTab";
import { ChatTab } from "./ChatTab";
import { DocumentsTab } from "./DocumentsTab";

const normLabel = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9\u0900-\u097F]+/g, " ").trim();

const PanelBody = ({
  embedded, logoSrc, activeField, activeSection, isLoading, response, error, progress, fieldOptions, onApply,
  docApi, formFields, formId, onAutofill, chatMessages, onChatMessagesChange, onSendChat, onClose, onJumpToField, initialTab,
}) => {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState(initialTab || "field-help");
  const [preview, setPreview] = useState(null); // last autofill preview → per-field "upload X" hints

  useEffect(() => {
    if (activeField) setActiveTab("field-help");
  }, [activeField]);

  const missing = preview?.mappings?.find((m) => m.status === "missing" && normLabel(m.label) === normLabel(activeField));
  const docHint = missing?.suggested_documents?.length ? missing.suggested_documents : null;

  const shell = embedded
    ? "w-full h-full bg-slate-900"
    : "fixed right-0 top-0 h-full w-full sm:w-[380px] md:w-[420px] bg-slate-900/95 backdrop-blur-xl z-50 border-l border-white/10 shadow-2xl";

  return (
    <div className={`${shell} flex flex-col text-white`} data-testid="ai-helper-panel">
      <PanelHeader logoSrc={logoSrc} onClose={onClose} />
      <ProgressBar progress={progress} onJumpToField={onJumpToField} />
      <PanelTabs activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === "field-help" ? (
        <FieldHelpTab
          activeField={activeField}
          activeSection={activeSection}
          isLoading={isLoading}
          response={response}
          error={error}
          fieldOptions={fieldOptions}
          onApply={onApply}
          docHint={docHint}
          onOpenDocuments={() => setActiveTab("documents")}
        />
      ) : activeTab === "documents" ? (
        <DocumentsTab docApi={docApi} formFields={formFields} formId={formId} onAutofill={onAutofill} onPreview={setPreview} />
      ) : (
        <ChatTab
          messages={chatMessages}
          onMessagesChange={onChatMessagesChange}
          onSend={onSendChat}
        />
      )}

      <div className="border-t border-white/10 px-5 py-3 bg-slate-900/50">
        <p className="text-xs text-white/30 text-center">{t("footer.note")}</p>
      </div>
    </div>
  );
};

// Single source of truth for the FormWise panel; used by the web demo and the Chrome extension iframe.
export const HelperPanel = ({ onLanguageChange, ...props }) => (
  <LangProvider onChange={onLanguageChange}>
    <PanelBody {...props} />
  </LangProvider>
);
