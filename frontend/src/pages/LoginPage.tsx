import { useState, type FormEvent } from "react";
import {
  LoginPage as PFLoginPage,
  LoginForm,
  ListVariant,
} from "@patternfly/react-core";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export function LoginPage() {
  const { login } = useAuth();
  const { theme } = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const logoSrc = theme === "dark" ? "/logo-tam-dark.png" : "/logo-tam-light.png";

  return (
    <PFLoginPage
      brandImgSrc={logoSrc}
      brandImgAlt="TAM-Copilot"
      loginTitle="TAM-Copilot"
      loginSubtitle="Sign in to your admin account"
      textContent=""
      socialMediaLoginContent=""
      signUpForAccountMessage=""
      forgotCredentials=""
      footerListVariants={ListVariant.inline}
    >
      <LoginForm
        showHelperText={!!error}
        helperText={error}
        helperTextIcon={undefined}
        usernameLabel="Username"
        usernameValue={username}
        onChangeUsername={(_e, val) => setUsername(val)}
        passwordLabel="Password"
        passwordValue={password}
        onChangePassword={(_e, val) => setPassword(val)}
        isShowPasswordEnabled
        showPasswordAriaLabel="Show password"
        hidePasswordAriaLabel="Hide password"
        isLoginButtonDisabled={loading || !username || !password}
        onLoginButtonClick={handleSubmit}
        loginButtonLabel={loading ? "Signing in..." : "Sign in"}
      />
    </PFLoginPage>
  );
}
