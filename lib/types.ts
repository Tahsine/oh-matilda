export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
};

export type FileStatus = 'indexed' | 'pending' | 'indexing' | 'error';

export type FileType = 'pdf' | 'docx';

export type FileItem = {
  id: string;
  name: string;
  type: FileType;
  size: number;
  date: string;
  status: FileStatus;
  localUri: string;
  errorMessage?: string;
};

export type Chunk = {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
};

export type Conversation = {
  id: string;
  title: string;
  preview: string;
  date: Date;
  favorite: boolean;
};
