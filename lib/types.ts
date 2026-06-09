export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export type FileStatus = 'indexed' | 'pending' | 'error';

export type FileType = 'pdf' | 'docx';

export type FileItem = {
  id: string;
  name: string;
  type: FileType;
  size: string;
  date: string;
  status: FileStatus;
};

export type Conversation = {
  id: string;
  title: string;
  preview: string;
  date: Date;
};
