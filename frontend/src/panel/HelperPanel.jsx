import { useEffect, useState } from "react";
import { PanelHeader } from "./PanelHeader";
import { PanelTabs } from "./PanelTabs";
import { ProgressBar } from "./ProgressBar";
import { FieldHelpTab } from "./FieldHelpTab";
import { ChatTab } from "./ChatTab";
import { DocumentsTab } from "./DocumentsTab";

// Single source of truth for the FormWise panel; used by the web demo and the Chrome extension iframe.
export const HelperPanel = ({
  embedded = false,
  logoSrc,
  activeField,
  activeSection,
  isLoading,
  response,
  error,
  progress,
  fieldOptions,
  onApply,
  docApi,
  formFields,
  formId,
  onAutofill,
  chatMessages,
  onChatMessagesChange,
  onSendChat,
  onClose,
  onJumpToField,
}) => {
  const [activeTab, setActiveTab] = useState("field-help");

  useEffect(() => {
    if (activeField) setActiveTab("field-help");
  }, [activeField]);

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
        />
      ) : activeTab === "documents" ? (
        <DocumentsTab docApi={docApi} formFields={formFields} formId={formId} onAutofill={onAutofill} />
      ) : (
        <ChatTab
          messages={chatMessages}
          onMessagesChange={onChatMessagesChange}
          onSend={onSendChat}
        />
      )}

      <div className="border-t border-white/10 px-5 py-3 bg-slate-900/50">
        <p className="text-xs text-white/30 text-center">AI-powered guidance</p>
      </div>
    </div>
  );
};
