import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/auth-context';
import { AuthForm, AuthShell, SubmitButton, TextField } from '../components/AuthShell';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export function RegisterPage() {
  useDocumentTitle('Criar conta — Ravion Barber');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await register({ name, email, password });
      navigate('/conta');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível criar a conta.');
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Criar conta"
      description="O cadastro público entra como cliente neste contexto."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="text-foreground">
            Entrar
          </Link>
        </>
      }
    >
      <AuthForm onSubmit={(event) => void onSubmit(event)}>
        <TextField label="Nome" type="text" value={name} autoComplete="name" onChange={setName} />
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
          autoComplete="new-password"
          onChange={setPassword}
        />
        {error ? (
          <p role="alert" className="text-sm normal-case tracking-normal text-foreground">
            {error}
          </p>
        ) : null}
        <SubmitButton pending={pending}>Criar conta</SubmitButton>
      </AuthForm>
    </AuthShell>
  );
}
