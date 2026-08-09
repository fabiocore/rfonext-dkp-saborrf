import { useState } from 'react';
import { uploadFile } from '../api/client';

export function ImageUploadInput({
  value,
  onChange,
  required,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  required?: boolean;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError(null);
    try {
      const result = await uploadFile(file);
      onChange(result.url);
    } catch {
      setError('Falha ao enviar imagem.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="image-upload">
      <input type="file" accept="image/*" onChange={handleChange} required={required && !value} />
      {isUploading && <span>Enviando...</span>}
      {error && <span className="form-error">{error}</span>}
      {value && (
        <div className="image-upload-preview">
          <img src={value} alt="Comprovação" />
          <button type="button" onClick={() => onChange(null)}>
            Remover
          </button>
        </div>
      )}
    </div>
  );
}
