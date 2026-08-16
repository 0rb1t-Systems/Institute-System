import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateStudentProfile, uploadStudentProfileImage } from '@/lib/api';
import { Loader2, Upload, X, Image as ImageIcon } from 'lucide-react';
import { isValidEmail } from '@/lib/utils';
import { normalizePhoneNumber, isValidPhoneFormat } from '@/lib/validatePhoneNumber';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { notify, MESSAGES } from '@/lib/notify';

const EditStudentModal = ({ student, isOpen, onClose, onSuccess }) => {
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    university_name: '',
    faculty: '',
    year: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});
  
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Initialize form when student changes or modal opens
  useEffect(() => {
    if (student && isOpen) {
      setFormData({
        name: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        university_name: student.university_name || '',
        faculty: student.faculty || '',
        year: student.year || ''
      });
      setPreviewUrl(student.avatar_url || null);
      setFile(null);
      setErrors({});
    }
  }, [student, isOpen]);

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    // Clear error for the field being edited
    if (errors[id]) {
      setErrors(prev => ({ ...prev, [id]: null }));
    }
  };

  const validateForm = () => {
    const newErrors: any = {};
    if (!formData.name.trim()) newErrors.name = MESSAGES.VALIDATION.FULL_NAME;
    if (!formData.email.trim()) newErrors.email = MESSAGES.VALIDATION.EMAIL_REQUIRED;
    else if (!isValidEmail(formData.email)) newErrors.email = MESSAGES.VALIDATION.EMAIL;
    
    if (formData.phone) {
        const normalizedPhone = normalizePhoneNumber(formData.phone);
        if (!isValidPhoneFormat(normalizedPhone)) {
             newErrors.phone = MESSAGES.VALIDATION.PHONE;
        }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Image Upload Handlers ---
  const processFile = useCallback((selectedFile) => {
    setErrors(prev => ({ ...prev, file: null }));

    if (!selectedFile) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(selectedFile.type)) {
      setErrors(prev => ({ ...prev, file: "Must be a JPG, PNG, GIF, or WebP image" }));
      return;
    }

    // Validate size (2MB max — matches storage bucket limit)
    if (selectedFile.size > 2 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, file: "Image must be smaller than 2MB" }));
      return;
    }

    setFile(selectedFile);
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
  }, []);

  const handleFileChange = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const clearImage = async () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (student?.avatar_url) {
      try {
        const { removeAvatar } = await import('@/lib/api');
        await removeAvatar(student.id);
        setPreviewUrl(null);
        notify.success('Profile picture removed.');
        if (onSuccess) onSuccess();
      } catch (err) {
        setPreviewUrl(student?.avatar_url || null);
        notify.error(err, { context: 'EditStudentModal.clearImage', fallback: MESSAGES.UPDATE_FAILED });
      }
    } else {
      setPreviewUrl(null);
    }
  };

  // --- Submit Handler ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      let finalAvatarUrl = student.avatar_url;

      // Upload new image if selected
      if (file) {
        finalAvatarUrl = await uploadStudentProfileImage(file, student.id);
      }

      const updateData = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone ? normalizePhoneNumber(formData.phone) : null,
        university_name: formData.university_name,
        faculty: formData.faculty,
        year: formData.year,
        avatar_url: finalAvatarUrl
      };

      await updateStudentProfile(student.id, updateData);

      notify.success(MESSAGES.SUCCESS.STUDENT_UPDATED);
      
      if (onSuccess) onSuccess();
      onClose();

    } catch (error) {
      notify.error(error, {
        context: 'EditStudentModal',
        fallback: MESSAGES.UPDATE_FAILED,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!student) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[550px] bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Student Profile</DialogTitle>
        </DialogHeader>

        <form id="edit-student-form" onSubmit={handleSubmit} className="overflow-y-auto pr-2 py-4 space-y-6 flex-grow">
          
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
            <Label className="text-slate-300 w-full text-left font-semibold">Profile Picture</Label>
            
            <div className="flex items-center gap-6 w-full">
              <div className="relative">
                <Avatar className="h-24 w-24 border-2 border-slate-700 bg-slate-800">
                    <AvatarImage src={previewUrl} alt={formData.name} className="object-cover" />
                    <AvatarFallback className="bg-slate-800 text-slate-400 text-xl">
                        {formData.name?.substring(0, 2).toUpperCase() || 'ST'}
                    </AvatarFallback>
                </Avatar>
                {file && (
                    <button 
                        type="button" 
                        onClick={clearImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                        title="Remove selected image"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
              </div>

              <div 
                className={`flex-1 border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer
                  ${isDragging ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'}
                  ${errors.file ? 'border-red-500 bg-red-500/10' : ''}
                `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/jpeg,image/png,image/gif,image/webp" 
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Upload className="h-6 w-6 mb-1" />
                  <p className="text-sm font-medium text-slate-300">Click or drag image to upload</p>
                  <p className="text-xs text-slate-500">JPG, PNG, GIF up to 5MB</p>
                </div>
              </div>
            </div>
            {errors.file && <p className="text-xs text-red-400 w-full text-left">{errors.file}</p>}
          </div>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-slate-300">Full Name *</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={handleChange} 
                className={`bg-slate-950 border-slate-800 text-white ${errors.name ? 'border-red-500' : ''}`} 
              />
              {errors.name && <p className="text-xs text-red-400">{errors.name}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-slate-300">Email Address *</Label>
                <Input 
                  id="email" 
                  type="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  className={`bg-slate-950 border-slate-800 text-white ${errors.email ? 'border-red-500' : ''}`} 
                />
                {errors.email && <p className="text-xs text-red-400">{errors.email}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone" className="text-slate-300">Phone Number</Label>
                <Input 
                  id="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  className={`bg-slate-950 border-slate-800 text-white ${errors.phone ? 'border-red-500' : ''}`} 
                />
                {errors.phone && <p className="text-xs text-red-400">{errors.phone}</p>}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="university_name" className="text-slate-300">University</Label>
              <Input 
                id="university_name" 
                value={formData.university_name} 
                onChange={handleChange} 
                className="bg-slate-950 border-slate-800 text-white" 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="faculty" className="text-slate-300">Faculty</Label>
                <Input 
                  id="faculty" 
                  value={formData.faculty} 
                  onChange={handleChange} 
                  className="bg-slate-950 border-slate-800 text-white" 
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="year" className="text-slate-300">Year of Study</Label>
                <Input 
                  id="year" 
                  value={formData.year} 
                  onChange={handleChange} 
                  className="bg-slate-950 border-slate-800 text-white" 
                />
              </div>
            </div>
          </div>
        </form>

        <DialogFooter className="pt-4 border-t border-slate-800 mt-auto">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting} className="text-slate-400 hover:text-white hover:bg-slate-800">
            Cancel
          </Button>
          <Button type="submit" form="edit-student-form" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[120px]">
            {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditStudentModal;