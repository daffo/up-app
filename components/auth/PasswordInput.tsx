import { useState } from 'react';
import { View, TextInput, TouchableOpacity, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuthStyles } from './authStyles';

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'>;

export default function PasswordInput(props: PasswordInputProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const { styles, colors } = useAuthStyles();

  return (
    <View style={styles.passwordContainer}>
      <TextInput
        {...props}
        style={[styles.passwordInput, props.style]}
        secureTextEntry={!visible}
      />
      <TouchableOpacity
        style={styles.eyeButton}
        onPress={() => setVisible(!visible)}
        accessibilityLabel={t(visible ? 'auth.hidePassword' : 'auth.showPassword')}
      >
        <Ionicons name={visible ? 'eye-off' : 'eye'} size={22} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
}
