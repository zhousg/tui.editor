import { ParserOptions } from '@t/parser';
import { ToastMark } from '../toastmark';
import { Parser } from '../commonmark/blocks';
import { getChildNodes } from '../nodeHelper';
import { Node } from '../commonmark/node';

function removeIdAttrFromAllNode(root: Node) {
  const walker = root.walker();
  let event;
  while ((event = walker.next())) {
    const { entering, node } = event;
    if (entering) {
      // @ts-ignore
      delete node.id;
    }
  }
}

function assertParseResult(doc: ToastMark, lineTexts: string[], options?: Partial<ParserOptions>) {
  expect(doc.getLineTexts()).toEqual(lineTexts);

  const reader = new Parser(options);
  const root = doc.getRootNode();
  const expectedRoot = reader.parse(lineTexts.join('\n'));

  removeIdAttrFromAllNode(root);
  removeIdAttrFromAllNode(expectedRoot);
  expect(root).toEqual(expectedRoot);
}

function assertResultNodes(doc: ToastMark, nodes: Node[], startIdx = 0) {
  const root = doc.getRootNode();
  const newNodes = getChildNodes(root);

  for (let i = 0; i < nodes.length; i += 1) {
    expect(nodes[i]).toBe(newNodes[i + startIdx]);
  }
}

describe('findNodeAtPosition()', () => {
  it('should return a node at the given position', () => {
    const doc = new ToastMark('# Hello *World*\n\n- Item 1\n- Item **2**');

    expect(doc.findNodeAtPosition([1, 1])).toMatchObject({
      type: 'heading',
    });

    expect(doc.findNodeAtPosition([1, 3])).toMatchObject({
      type: 'text',
      literal: 'Hello ',
    });

    expect(doc.findNodeAtPosition([1, 9])).toMatchObject({
      type: 'emph',
      firstChild: {
        type: 'text',
        literal: 'World',
      },
    });

    expect(doc.findNodeAtPosition([1, 10])).toMatchObject({
      type: 'text',
      literal: 'World',
    });

    expect(doc.findNodeAtPosition([3, 1])).toMatchObject({
      type: 'item',
    });

    expect(doc.findNodeAtPosition([3, 3])).toMatchObject({
      type: 'text',
      literal: 'Item 1',
    });

    expect(doc.findNodeAtPosition([4, 8])).toMatchObject({
      type: 'strong',
      firstChild: {
        type: 'text',
        literal: '2',
      },
    });

    expect(doc.findNodeAtPosition([4, 10])).toMatchObject({
      type: 'text',
      literal: '2',
    });

    expect(doc.findNodeAtPosition([5, 1])).toBeNull();
  });

  it('should return null if matched node does not exist', () => {
    const doc = new ToastMark('# Hello\n\nWorld');

    // position in between two node (blank line)
    expect(doc.findNodeAtPosition([2, 1])).toBeNull();

    // position out of document range
    expect(doc.findNodeAtPosition([4, 1])).toBeNull();
  });
});

describe('findFirstNodeAtLine()', () => {
  const markdown = [
    '# Hello *World*',
    '',
    '- Item D1',
    '  - Item D2',
    '![Image](URL)',
    '',
    'Paragraph',
  ].join('\n');

  it('should return the first node at the given line', () => {
    const doc = new ToastMark(markdown);

    expect(doc.findFirstNodeAtLine(1)).toMatchObject({ type: 'heading' });
    expect(doc.findFirstNodeAtLine(3)).toMatchObject({
      type: 'list',
      prev: { type: 'heading' },
    });
    expect(doc.findFirstNodeAtLine(4)).toMatchObject({
      type: 'list',
      parent: { type: 'item' },
    });
    expect(doc.findFirstNodeAtLine(5)).toMatchObject({ type: 'image' });
    expect(doc.findFirstNodeAtLine(7)).toMatchObject({ type: 'paragraph' });
  });

  it('if the given line is blank, returns the first node at the previous line', () => {
    const doc = new ToastMark(markdown);

    expect(doc.findFirstNodeAtLine(2)).toMatchObject({ type: 'heading' });
    expect(doc.findFirstNodeAtLine(6)).toMatchObject({ type: 'image' });
    expect(doc.findFirstNodeAtLine(8)).toMatchObject({ type: 'paragraph' });
  });

  it('should return null if nothing mathces', () => {
    const doc = new ToastMark('\n\n');

    expect(doc.findFirstNodeAtLine(0)).toBeNull();
    expect(doc.findFirstNodeAtLine(1)).toBeNull();
    expect(doc.findFirstNodeAtLine(2)).toBeNull();
    expect(doc.findFirstNodeAtLine(3)).toBeNull();
  });
});

describe('editText()', () => {
  describe('single paragraph', () => {
    it('should insert character within a line', () => {
      const doc = new ToastMark('Hello World');
      const result = doc.editMarkdown([1, 6], [1, 6], ',')[0];

      assertParseResult(doc, ['Hello, World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should remove entire text', () => {
      const doc = new ToastMark('Hello World');
      const result = doc.editMarkdown([1, 1], [1, 12], '')[0];

      assertParseResult(doc, ['']);
      assertResultNodes(doc, result.nodes);
    });

    it('should remove preceding newline', () => {
      const doc = new ToastMark('\nHello World');
      const result = doc.editMarkdown([1, 1], [2, 1], '')[0];

      assertParseResult(doc, ['Hello World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should remove last newline', () => {
      const doc = new ToastMark('Hello World\n');
      const result = doc.editMarkdown([1, 12], [2, 1], '')[0];

      assertParseResult(doc, ['Hello World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should insert characters and newlines', () => {
      const doc = new ToastMark('Hello World');
      const result = doc.editMarkdown([1, 6], [1, 7], '!\n\nMy ')[0];

      assertParseResult(doc, ['Hello!', '', 'My World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should replace multiline text with characters', () => {
      const doc = new ToastMark('Hello\nMy\nWorld');
      const result = doc.editMarkdown([1, 5], [3, 3], 'ooo Wooo')[0];

      assertParseResult(doc, ['Hellooo Wooorld']);
      assertResultNodes(doc, result.nodes);
    });

    it('should prepend characters', () => {
      const doc = new ToastMark('Hello World');
      const result = doc.editMarkdown([1, 1], [1, 1], 'Hi, ')[0];

      assertParseResult(doc, ['Hi, Hello World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should append character', () => {
      const doc = new ToastMark('Hello World');
      const result = doc.editMarkdown([1, 12], [1, 12], '!!')[0];

      assertParseResult(doc, ['Hello World!!']);
      assertResultNodes(doc, result.nodes);
    });

    it('should prepend newlines', () => {
      const doc = new ToastMark('Hello World');
      const result = doc.editMarkdown([1, 1], [1, 1], '\n\n\n')[0];

      assertParseResult(doc, ['', '', '', 'Hello World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should prepend characters (unmatched position)', () => {
      const doc = new ToastMark('  Hello World');
      const result = doc.editMarkdown([1, 1], [1, 1], 'Hi,')[0];

      assertParseResult(doc, ['Hi,  Hello World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should insert newlines into preceding empty line of first paragraph', () => {
      const doc = new ToastMark('\nHello World');
      const result = doc.editMarkdown([1, 1], [1, 1], '\n')[0];

      assertParseResult(doc, ['', '', 'Hello World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should append characters with newline', () => {
      const doc = new ToastMark('Hello World\n');
      const result = doc.editMarkdown([2, 1], [2, 1], '\nHi')[0];

      assertParseResult(doc, ['Hello World', '', 'Hi']);
      assertResultNodes(doc, result.nodes);
    });

    it('should remove lines with top blank line', () => {
      const doc = new ToastMark('\n\nabove linebreak\n\nHello World');
      const result = doc.editMarkdown([1, 1], [5, 12], '')[0];

      assertParseResult(doc, ['']);
      assertResultNodes(doc, result.nodes);
    });

    it('should parse the table with including prev line', () => {
      const doc = new ToastMark('| a | b\n--| ---\n c');
      const result = doc.editMarkdown([3, 1], [3, 3], '|c|')[0];

      assertParseResult(doc, ['| a | b', '--| ---', '|c|']);
      assertResultNodes(doc, result.nodes);
    });
  });

  describe('multiple paragraph', () => {
    it('should insert paragraphs within multiple paragraphs', () => {
      const doc = new ToastMark('Hello\n\nMy\n\nWorld');
      const result = doc.editMarkdown([1, 6], [5, 1], ',\n\nMy ')[0];

      assertParseResult(doc, ['Hello,', '', 'My World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should replace multiple paragraphs with a heading', () => {
      const doc = new ToastMark('Hello\n\nMy\n\nWorld');
      const result = doc.editMarkdown([1, 1], [5, 1], '# Hello ')[0];

      assertParseResult(doc, ['# Hello World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should remove last block with newlines', () => {
      const doc = new ToastMark('Hello\n\nWorld\n');
      const result = doc.editMarkdown([3, 1], [4, 1], '')[0];

      assertParseResult(doc, ['Hello', '', '']);
      assertResultNodes(doc, result.nodes);
    });

    it('should insert a characters in between paragraphs', () => {
      const doc = new ToastMark('Hello\n\nWorld');
      const result = doc.editMarkdown([2, 1], [2, 1], 'My')[0];

      assertParseResult(doc, ['Hello', 'My', 'World']);
      assertResultNodes(doc, result.nodes);
    });

    it('update sourcepos for every next nodes', () => {
      const doc = new ToastMark('Hello\n\nMy\n\nWorld *!!*');
      const result = doc.editMarkdown([1, 1], [1, 1], 'Hey,\n')[0];

      assertParseResult(doc, ['Hey,', 'Hello', '', 'My', '', 'World *!!*']);
      assertResultNodes(doc, result.nodes);
    });

    it('should update to fenced code blocks to the end of the document', () => {
      const doc = new ToastMark('``\nHello\n\nMy World');
      const result = doc.editMarkdown([1, 3], [1, 3], '`')[0];

      assertParseResult(doc, ['```', 'Hello', '', 'My World']);
      assertResultNodes(doc, result.nodes);
    });

    it('should update to custom block to the end of the document', () => {
      const doc = new ToastMark('$\nHello\n\nMy World');
      const result = doc.editMarkdown([1, 2], [1, 2], '$custom')[0];

      assertParseResult(doc, ['$$custom', 'Hello', '', 'My World']);
      assertResultNodes(doc, result.nodes);
    });
  });

  describe('list item', () => {
    it('single empty item - append characters', () => {
      const doc = new ToastMark('-');
      const result = doc.editMarkdown([1, 2], [1, 2], ' Hello')[0];

      assertParseResult(doc, ['- Hello']);
      assertResultNodes(doc, result.nodes);
    });

    it('single item paragraph - append characters', () => {
      const doc = new ToastMark('- Hello');
      const result = doc.editMarkdown([1, 8], [1, 8], ' World')[0];

      assertParseResult(doc, ['- Hello World']);
      assertResultNodes(doc, result.nodes);
    });

    it('single item - append new item', () => {
      const doc = new ToastMark('- Hello');
      const result = doc.editMarkdown([1, 8], [1, 8], '\n- World')[0];

      assertParseResult(doc, ['- Hello', '- World']);
      assertResultNodes(doc, result.nodes);
    });

    it('prepend a new list before an existing list', () => {
      const doc = new ToastMark('Hello\n\n- World');
      const result = doc.editMarkdown([1, 1], [1, 1], '- ')[0];

      assertParseResult(doc, ['- Hello', '', '- World']);
      assertResultNodes(doc, result.nodes);
    });

    it('prepend a new list before a padded paragraph', () => {
      const doc = new ToastMark('\n\n  My\n\n  World');
      const result = doc.editMarkdown([1, 1], [1, 1], '- Hello')[0];

      assertParseResult(doc, ['- Hello', '', '  My', '', '  World']);
      assertResultNodes(doc, result.nodes);
    });

    it('prepend a new list before a padded codeblock containing list-like text', () => {
      const doc = new ToastMark('\n\n    - World');
      const result = doc.editMarkdown([1, 1], [1, 1], '- Hello')[0];

      assertParseResult(doc, ['- Hello', '', '    - World']);
      assertResultNodes(doc, result.nodes);
    });

    it('convert a paragraph preceded by a list to a list ', () => {
      const doc = new ToastMark('- Hello\n\nWorld');
      const result = doc.editMarkdown([3, 1], [3, 1], '- ')[0];

      assertParseResult(doc, ['- Hello', '', '- World']);
      assertResultNodes(doc, result.nodes);
    });

    it('add paddings to a paragraph preceded by a list', () => {
      const doc = new ToastMark('- Hello\n\nWorld');
      const result = doc.editMarkdown([3, 1], [3, 1], '  ')[0];

      assertParseResult(doc, ['- Hello', '', '  World']);
      assertResultNodes(doc, result.nodes);
    });
  });

  describe('Reference Def', () => {
    it('should parse reference link nodes when modifying url of Reference Def node', () => {
      const doc = new ToastMark('[foo]: /test\n\n[foo]\n\n[foo]', { referenceDefinition: true });
      doc.editMarkdown([1, 1], [1, 13], '[foo]: /test2');

      assertParseResult(doc, ['[foo]: /test2', '', '[foo]', '', '[foo]'], {
        referenceDefinition: true,
      });
    });

    it('should change reference link nodes to paragraph nodes when modifying label of Reference Def node', () => {
      const doc = new ToastMark('[foo]: /test\n\n[foo]\n\n[foo]', { referenceDefinition: true });
      doc.editMarkdown([1, 1], [1, 13], '[food]: /test2');

      assertParseResult(doc, ['[food]: /test2', '', '[foo]', '', '[foo]'], {
        referenceDefinition: true,
      });
    });

    it('should merge the Reference Def node as paragraph', () => {
      const doc = new ToastMark('test\n\n[foo]: /test', { referenceDefinition: true });
      doc.editMarkdown([2, 1], [2, 1], 'test');

      assertParseResult(doc, ['test', 'test', '[foo]: /test'], {
        referenceDefinition: true,
      });
    });
  });
});

it('return the node - findNodeById()', () => {
  const doc = new ToastMark('# Hello *World*\n\n- Item 1\n- Item **2**');
  const firstNodeId = doc.findFirstNodeAtLine(1)!.id;

  expect(doc.findNodeById(firstNodeId)).toMatchObject({
    type: 'heading',
  });
});

it('remove all node in the map - removeAllNode()', () => {
  const doc = new ToastMark('# Hello *World*\n\n- Item 1\n- Item **2**');
  const firstNodeId = doc.findFirstNodeAtLine(1)!.id;

  doc.removeAllNode();
  expect(doc.findNodeById(firstNodeId)).toEqual(null);
});

describe('front matter', () => {
  it('should change normal paragraph to front matter ', () => {
    const doc = new ToastMark('---\ntitle: front matter\n--', { frontMatter: true });
    doc.editMarkdown([3, 3], [3, 3], '-');

    assertParseResult(doc, ['---', 'title: front matter', '---'], { frontMatter: true });
  });

  it('should change front matter to normal paragraph', () => {
    const doc = new ToastMark('---\ntitle: front matter\n---', { frontMatter: true });
    doc.editMarkdown([3, 2], [3, 3], '');

    assertParseResult(doc, ['---', 'title: front matter', '--'], { frontMatter: true });
  });

  it('should change front matter to setext heading', () => {
    const doc = new ToastMark('---\ntitle: front matter\n---', { frontMatter: true });
    doc.editMarkdown([1, 1], [1, 1], 'heading\n');

    assertParseResult(doc, ['heading', '---', 'title: front matter', '---'], { frontMatter: true });
  });

  it('following paragraph should be changed properly', () => {
    const doc = new ToastMark('---\ntitle: front matter\n---\npara', { frontMatter: true });
    doc.editMarkdown([4, 1], [4, 5], 'changed');

    assertParseResult(doc, ['---', 'title: front matter', '---', 'changed'], { frontMatter: true });
  });
});
