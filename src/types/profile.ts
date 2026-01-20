export interface ProfileField {
  id: string;
  label: string;
  category: string;
  hasExpiry: boolean;
  hasDocument: boolean;
  placeholder: string;
  icon: string;
}

export interface ProfileCategory {
  id: string;
  name: string;
  icon: string;
}

export interface ProfileFieldData {
  value: string;
  expiryDate?: string;
  documentName?: string;
  documentData?: string;
  documentType?: string;
}
