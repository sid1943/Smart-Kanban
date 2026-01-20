import React from 'react';
import { ProfileCategory, ProfileField, ProfileFieldData } from '../types/profile';

interface ProfileViewProps {
  completion: number;
  customProfileCategories: ProfileCategory[];
  customProfileFields: ProfileField[];
  activeProfileCategory: string;
  profileData: Record<string, ProfileFieldData>;
  profileDocumentErrors: Record<string, string>;
  baseProfileTemplateIds: Set<string>;
  onBack: () => void;
  onSelectCategory: (categoryId: string) => void;
  onOpenAddCategory: () => void;
  onOpenAddField: (categoryId: string) => void;
  onDeleteProfileCategory: (categoryId: string) => void;
  onDeleteProfileField: (fieldId: string) => void;
  onUpdateProfileField: (fieldId: string, value: string, expiryDate?: string) => void;
  onUploadProfileDocument: (fieldId: string, file: File) => void;
  onRemoveProfileDocument: (fieldId: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  completion,
  customProfileCategories,
  customProfileFields,
  activeProfileCategory,
  profileData,
  profileDocumentErrors,
  baseProfileTemplateIds,
  onBack,
  onSelectCategory,
  onOpenAddCategory,
  onOpenAddField,
  onDeleteProfileCategory,
  onDeleteProfileField,
  onUpdateProfileField,
  onUploadProfileDocument,
  onRemoveProfileDocument,
}) => {
  const filteredTemplates = customProfileFields.filter(t => t.category === activeProfileCategory);
  const activeCategory = customProfileCategories.find(c => c.id === activeProfileCategory);

  return (
    <div className="min-h-screen bg-[#1d2125]">
      {/* Header */}
      <div className="bg-[#1d2125] border-b border-[#3d444d] px-4 py-3 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#9fadbc] hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-xl font-bold text-white">My Profile</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Completion Card */}
        <div className="bg-[#22272b] rounded-xl p-6 mb-6 border border-[#3d444d]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-semibold text-lg">Profile Completion</h2>
              <p className="text-[#9fadbc] text-sm">Fill in your information to enable smart task detection</p>
            </div>
            <div className="text-3xl font-bold text-[#579dff]">{completion}%</div>
          </div>
          <div className="h-3 bg-[#1a1f26] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#579dff] transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 items-center">
          {customProfileCategories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-2
                        ${activeProfileCategory === cat.id
                          ? 'bg-[#579dff] text-white'
                          : 'bg-[#22272b] text-[#9fadbc] hover:bg-[#3d444d] hover:text-white'
                        }`}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
          <button
            onClick={onOpenAddCategory}
            className="px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1
                      bg-[#22272b] text-[#9fadbc] hover:bg-[#3d444d] hover:text-white border border-dashed border-[#3d444d]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
        </div>

        {/* Category Header with Delete */}
        {activeCategory && (
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <span>{activeCategory.icon}</span>
              {activeCategory.name}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onOpenAddField(activeProfileCategory)}
                className="px-3 py-1.5 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded text-sm flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Field
              </button>
              {!['travel', 'identity', 'health', 'skills', 'education'].includes(activeCategory.id) && (
                <button
                  onClick={() => {
                    if (confirm(`Delete category "${activeCategory.name}" and all its fields?`)) {
                      onDeleteProfileCategory(activeCategory.id);
                      onSelectCategory(customProfileCategories[0]?.id || 'travel');
                    }
                  }}
                  className="px-3 py-1.5 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded text-sm flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Category
                </button>
              )}
            </div>
          </div>
        )}

        {/* Profile Fields */}
        <div className="space-y-4">
          {filteredTemplates.map(template => {
            const data = profileData[template.id] || {};
            const isExpired = data.expiryDate && new Date(data.expiryDate) < new Date();
            const isExpiringSoon = data.expiryDate && !isExpired &&
              new Date(data.expiryDate) < new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000);

            return (
              <div
                key={template.id}
                className={`bg-[#22272b] rounded-xl p-4 border transition-all
                          ${isExpired ? 'border-red-500/50' : isExpiringSoon ? 'border-yellow-500/50' : 'border-[#3d444d]'}`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl">{template.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-medium">{template.label}</h3>
                        {isExpired && (
                          <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded">Expired</span>
                        )}
                        {isExpiringSoon && (
                          <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded">Expiring Soon</span>
                        )}
                        {data.value && !isExpired && !isExpiringSoon && (
                          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Complete</span>
                        )}
                      </div>
                      {!baseProfileTemplateIds.has(template.id) && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete field "${template.label}"?`)) {
                              onDeleteProfileField(template.id);
                            }
                          }}
                          className="p-1.5 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                          title="Delete field"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Value Input */}
                      <div>
                        <label className="text-[#9fadbc] text-xs mb-1 block">Value</label>
                        <input
                          type="text"
                          value={data.value || ''}
                          onChange={(e) => onUpdateProfileField(template.id, e.target.value, data.expiryDate)}
                          placeholder={template.placeholder}
                          className="w-full bg-[#1a1f26] border border-[#3d444d] rounded-lg px-3 py-2 text-white text-sm
                                   placeholder-white/30 focus:outline-none focus:border-[#579dff]"
                        />
                      </div>

                      {/* Expiry Date Input */}
                      {template.hasExpiry && (
                        <div>
                          <label className="text-[#9fadbc] text-xs mb-1 block">Expiry Date</label>
                          <input
                            type="date"
                            value={data.expiryDate || ''}
                            onChange={(e) => onUpdateProfileField(template.id, data.value || '', e.target.value)}
                            className="w-full bg-[#1a1f26] border border-[#3d444d] rounded-lg px-3 py-2 text-white text-sm
                                     focus:outline-none focus:border-[#579dff]"
                          />
                        </div>
                      )}
                    </div>

                    {/* Document Upload */}
                    {template.hasDocument && (
                      <div className="mt-3">
                        <label className="text-[#9fadbc] text-xs mb-1 block">Supporting Document</label>
                        {profileDocumentErrors[template.id] && (
                          <p className="text-red-400 text-xs mb-2">
                            {profileDocumentErrors[template.id]}
                          </p>
                        )}
                        {data.documentName ? (
                          <div className="flex items-center gap-3 bg-[#1a1f26] rounded-lg p-3">
                            <svg className="w-8 h-8 text-[#579dff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm truncate">{data.documentName}</p>
                              <p className="text-[#9fadbc] text-xs">{data.documentType}</p>
                            </div>
                            <div className="flex gap-2">
                              {data.documentData && (
                                <a
                                  href={data.documentData}
                                  download={data.documentName}
                                  className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                                  title="Download"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                  </svg>
                                </a>
                              )}
                              <button
                                onClick={() => onRemoveProfileDocument(template.id)}
                                className="p-2 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                                title="Remove"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <label className="flex items-center gap-3 bg-[#1a1f26] hover:bg-[#282e33] rounded-lg p-3 cursor-pointer transition-all border border-dashed border-[#3d444d]">
                            <svg className="w-6 h-6 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span className="text-[#9fadbc] text-sm">Click to upload document (PDF, Image)</span>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) onUploadProfileDocument(template.id, file);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
