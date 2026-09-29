import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AuthForm, AuthShell, SubmitButton, TextField } from '../components/AuthShell';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function LoginPage() {
  useDocumentTitle('Entrar — Ravion Barber');
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login({ email, password });
      navigate('/conta');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível entrar.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Entrar"
      description="Acesse sua conta no contexto desta aplicação."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to="/register" className="text-foreground">
            Criar conta
          </Link>
        </>
      }
    >
      <AuthForm onSubmit={(event) => void onSubmit(event)}>
        <TextField
          label="E-mail"
          type="email"
          value={email}
          autoComplete="email"
          onChange={setEmail}
        />
        <TextField
          label="Senha"
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={setPassword}
        />
        {error ? (
          <p role="alert" className="text-sm normal-case tracking-normal text-foreground">
            {error}
          </p>
        ) : null}
        <SubmitButton pending={pending}>Entrar</SubmitButton>
      </AuthForm>
    </AuthShell>
  );
}
