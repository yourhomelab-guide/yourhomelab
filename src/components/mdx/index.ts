/**
 * Components available in every .mdx file without importing them.
 * Documented for authors in CONTRIBUTING.md.
 */
import CodeBlock from './CodeBlock.astro';
import InlineCode from './InlineCode.astro';
import Table from './Table.astro';
import Cards from './Cards.astro';
import Card from './Card.astro';
import Callout from './Callout.astro';
import Quiz from './Quiz.astro';
import Steps from './Steps.astro';
import Step from './Step.astro';
import OneWay from './OneWayMdx.astro';
import ServiceFiles from '../ServiceFiles.astro';

export const mdxComponents = {
  pre: CodeBlock,
  code: InlineCode,
  table: Table,
  Cards,
  Card,
  Callout,
  Quiz,
  Steps,
  Step,
  OneWay,
  ServiceFiles,
};
