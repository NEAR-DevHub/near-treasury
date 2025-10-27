import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";

const Markdown = ({ children }) => {
  return (
    <div className="markdown-content">
      <ReactMarkdown rehypePlugins={[rehypeRaw]}>{children}</ReactMarkdown>
    </div>
  );
};

export default Markdown;
