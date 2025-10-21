import ReactMarkdown from "react-markdown";

const Markdown = ({ children }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
};

export default Markdown;
