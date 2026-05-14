import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PensionReport } from '@/lib/types'

export function usePensionReports(userId: string | undefined) {
  return useQuery<PensionReport[]>({
    queryKey: ['pension_reports', userId],
    enabled: !!userId,
    queryFn: async () => {
      const res = await fetch(`/api/pension?userId=${userId}`)
      if (!res.ok) throw new Error('Failed to fetch pension reports')
      const data = await res.json()
      return data.reports || []
    },
  })
}

export function useUploadPensionReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ file, userId, manualData, pdfPassword }: {
      file?: File
      userId: string
      manualData?: Record<string, unknown>
      pdfPassword?: string
    }) => {
      const formData = new FormData()
      formData.append('userId', userId)
      if (file) formData.append('file', file)
      if (manualData) formData.append('manualData', JSON.stringify(manualData))
      if (pdfPassword) formData.append('pdfPassword', pdfPassword)

      const res = await fetch('/api/pension', { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        const error = new Error(err.error || 'Upload failed') as Error & { code?: string }
        if (err.code) error.code = err.code
        throw error
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['pension_reports', vars.userId] })
    },
  })
}
