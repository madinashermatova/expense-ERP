import { useRef, useState } from 'react';
import { UploadCloud, File, X } from 'lucide-react';
import styles from './Dropzone.module.css';

interface DropzoneProps {
  label?: string;
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  error?: string;
}

export const Dropzone = ({
  label,
  files,
  onChange,
  maxFiles = 5,
  maxSizeMB = 10,
  accept = 'image/*,application/pdf',
  error
}: DropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const processFiles = (newFiles: File[]) => {
    setLocalError(null);
    if (files.length + newFiles.length > maxFiles) {
      setLocalError(`Ko'pi bilan ${maxFiles} ta fayl yuklash mumkin.`);
      return;
    }

    const validFiles = newFiles.filter(file => {
      if (file.size > maxSizeMB * 1024 * 1024) {
        setLocalError(`Fayl hajmi ${maxSizeMB}MB dan oshmasligi kerak.`);
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      onChange([...files, ...validFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    onChange(newFiles);
  };

  return (
    <div className={styles.wrapper}>
      {label && <label className={styles.label}>{label}</label>}
      
      <div 
        className={`${styles.dropzone} ${isDragActive ? styles.active : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input 
          ref={inputRef}
          type="file" 
          multiple 
          accept={accept} 
          style={{ display: 'none' }} 
          onChange={handleChange}
        />
        <UploadCloud size={32} className={styles.dropzoneIcon} />
        <p className={styles.text}>Fayllarni shu yerga tashlang yoki bosing</p>
        <p className={styles.subtext}>PNG, JPG, PDF (Max: {maxSizeMB}MB, {maxFiles} tagacha)</p>
      </div>

      {(error || localError) && (
        <span className={styles.errorText}>{error || localError}</span>
      )}

      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((file, i) => (
            <div key={i} className={styles.fileItem}>
              <div className={styles.fileName}>
                <File size={16} />
                <span>{file.name}</span>
              </div>
              <button type="button" className={styles.removeBtn} onClick={() => removeFile(i)}>
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
