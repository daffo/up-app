import React from 'react';
import { TextInput, TextInputProps } from 'react-native';

type TrimmedTextInputProps = TextInputProps;

/**
 * A TextInput wrapper that automatically trims whitespace and newlines
 * from the edges of the input value when the field loses focus.
 */
export default function TrimmedTextInput({
  onBlur,
  onChangeText,
  value,
  ...props
}: TrimmedTextInputProps) {
  const handleBlur = (e: any) => {
    if (value && onChangeText) {
      const trimmed = value.trim();
      if (trimmed !== value) {
        onChangeText(trimmed);
      }
    }
    onBlur?.(e);
  };

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onBlur={handleBlur}
      {...props}
    />
  );
}
