/**
 * A simple JavaScript utility for conditionally joining together class names.
 * 
 * @example
 * classNames('foo', 'bar'); // => 'foo bar'
 * 
 * Inspired by:
 * @see https://github.com/JedWatson/classnames
 */
export default function classNames(...strings) {
  return strings
    .filter(string => string)
    .join(' ');
}
