import cx from 'classnames'
import remarkGfm from 'remark-gfm'
import ReactMarkdown from 'react-markdown'
import { ReactMarkdownOptions } from 'react-markdown/lib/react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { nord } from 'react-syntax-highlighter/dist/esm/styles/prism'

import styles from './Markdown.module.scss'

const Markdown = (options: ReactMarkdownOptions) => {
  return (
    <ReactMarkdown
      linkTarget='_blank'
      remarkPlugins={[remarkGfm]}
      components={{
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const language = match?.[1] ?? 'python'

          return !inline ? (
            <SyntaxHighlighter
              {...props}
              style={nord as { [key: string]: React.CSSProperties }}
              language={language}
              codeTagProps={{ className: styles.code }}
              PreTag="div"
            >{ String(children).trim() }</SyntaxHighlighter>
          ) : (
            <code {...props} className={cx(className, styles.code)}>
              {children}
            </code>
          )
        }
      }}
      {...options}
    />
  )
}

export default Markdown
