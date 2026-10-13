export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  VerifyEmail: {
    email: string;
    verificationCode?: string;
  };
  Onboarding: undefined;
  Home: undefined;
  AIChat: undefined;
  Modules: undefined;
  ModuleDetail: { id: string };
  Quiz: { moduleId?: string } | undefined;
  Schedule: undefined;
  Profile: undefined;
  PDFViewer: { fileId: string };
  FileViewer: { id: string };
};
