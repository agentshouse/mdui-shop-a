import {TextInput, type TextInputProps} from 'react-admin';
/** Keep incomplete numeric input in the business field; only completed numbers become numbers. */
export function parseBusinessNumber(value: string) {
  return /^[+-]?(?:\d+|\d*\.\d+)$/.test(value) && Number.isFinite(Number(value)) ? Number(value) : value;
}
export function BusinessNumberInput(props: TextInputProps) {
  return <TextInput {...props} type="text" inputProps={{inputMode:'decimal'}} parse={parseBusinessNumber} format={value => value == null ? '' : String(value)} />;
}
