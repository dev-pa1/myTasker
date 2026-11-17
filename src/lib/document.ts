export type BaseDocument = {
  $id: string;
  $createdAt: string;
  $updatedAt: string;
};

export type DocumentList<T> = {
  documents: T[];
  total: number;
};
