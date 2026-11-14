import { Navigate } from 'react-router'

// Đặt lại mật khẩu nằm chung trang quên mật khẩu (Figma B15: hai bước trên một màn).
export default function ResetPasswordPage() {
  return <Navigate to="/forgot-password" replace />
}
