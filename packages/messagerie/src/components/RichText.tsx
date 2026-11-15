import { parseRichText } from '../lib/richText';

export function RichText({ text }: { text: string }) {
  return (
    <>
      {parseRichText(text).map((node, index) => {
        if (node.kind === 'bold') return <strong key={index}>{node.text}</strong>;
        if (node.kind === 'italic') return <em key={index}>{node.text}</em>;
        if (node.kind === 'underline') return <u key={index}>{node.text}</u>;
        return node.text;
      })}
    </>
  );
}
