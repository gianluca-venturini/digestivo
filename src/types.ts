export interface Post {
  id: string;
  title: string;
  article: string | null;
  articleSummaryS: string | null;
  articleSummaryL: string | null;
  url: string;
  byUser: string;
  time: string; // ISO 8601
  domain: string | null;
  upvoted: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  byUser: string;
  text: string;
}
