/**
 * Public links used by the FAQ. The repository and production URLs are stable.
 * The Devpost entry and demo video are filled in once each is public; anything
 * left undefined is simply not rendered, so the page never shows a dead link.
 */
export const submissionLinks: {
  demoVideo?: string;
  devpostEntry?: string;
  production: string;
  repository: string;
} = {
  demoVideo: "https://youtu.be/ao5oraM6PO0",
  devpostEntry: "https://devpost.com/software/gyst-get-your-stuff-together",
  production: "https://gyst-web-mcp.vercel.app",
  repository: "https://github.com/knj007/GYST-WebMCP",
};
