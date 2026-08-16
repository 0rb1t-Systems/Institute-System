import React from 'react'
import {
  getTranscriptLayoutChrome,
  getTranscriptLayoutStyles,
  type TranscriptRenderData,
} from '@/lib/transcriptTemplates'

type Props = {
  data: TranscriptRenderData
  compact?: boolean
}

/**
 * Lightweight transcript layout preview for the template library.
 * Live issued transcripts still render via TranscriptView.
 */
const TranscriptCanvas = ({ data, compact = false }: Props) => {
  const chrome = getTranscriptLayoutChrome(data.layoutKey, data.primary)
  const styles = getTranscriptLayoutStyles(data.layoutKey, data.primary)
  const courses =
    data.courses?.length
      ? data.courses
      : [
          { code: 'IT101', name: 'Introduction to Computing', marks: '88', grade: 'B' },
          { code: 'ENG102', name: 'Business English', marks: '92', grade: 'A' },
          { code: 'ACC110', name: 'Accounting Basics', marks: '79', grade: 'C' },
        ]

  return (
    <div
      className={`bg-white text-black overflow-hidden ${chrome.outerFrame} ${chrome.pageExtra} ${
        compact ? 'text-[5px] leading-tight' : 'text-[10px]'
      }`}
      style={{ aspectRatio: '210 / 297' }}
    >
      <div
        className={`px-3 pt-2 pb-1 ${chrome.headerBorder}`}
        style={styles.headerBorderColor ? { borderBottomColor: styles.headerBorderColor } : undefined}
      >
        <div className="flex justify-between items-start gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="" className={`${compact ? 'h-5' : 'h-8'} w-auto object-contain`} />
            ) : (
              <div className={`${compact ? 'h-5 w-5' : 'h-8 w-8'} bg-slate-200 rounded-sm`} />
            )}
            <div className="min-w-0">
              <p className={`font-black uppercase truncate ${compact ? 'text-[6px]' : 'text-[11px]'}`}>
                {data.institutionName}
              </p>
              {data.contactLine ? (
                <p className={`text-slate-600 truncate ${compact ? 'text-[4px]' : 'text-[8px]'}`}>{data.contactLine}</p>
              ) : null}
            </div>
          </div>
          <div
            className={`${chrome.badgeBorder} px-1.5 py-0.5 shrink-0`}
            style={styles.badgeBorderColor ? { borderColor: styles.badgeBorderColor } : undefined}
          >
            <span className={`font-black uppercase ${compact ? 'text-[4px]' : 'text-[7px]'}`}>Official Transcript</span>
          </div>
        </div>
        <div
          className={`mt-1.5 py-1 px-2 text-center ${chrome.titleBar} ${chrome.titleBarText}`}
          style={styles.titleBarBg ? { backgroundColor: styles.titleBarBg } : undefined}
        >
          <p className={`font-bold uppercase tracking-wide ${compact ? 'text-[5px]' : 'text-[9px]'}`}>{data.programName}</p>
        </div>
      </div>

      <div className={`px-3 py-2 space-y-2 ${data.layoutKey === 'compact' ? 'space-y-1' : ''}`}>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className={`font-bold uppercase ${chrome.sectionRule} pb-0.5 mb-1 ${compact ? 'text-[4px]' : 'text-[7px]'}`}>
              Student Details
            </p>
            <p className={`font-bold uppercase ${compact ? 'text-[5px]' : 'text-[8px]'}`}>{data.studentName}</p>
            <p className={`font-mono ${compact ? 'text-[4px]' : 'text-[7px]'}`}>{data.studentCode}</p>
          </div>
          <div>
            <p className={`font-bold uppercase ${chrome.sectionRule} pb-0.5 mb-1 ${compact ? 'text-[4px]' : 'text-[7px]'}`}>
              Credential
            </p>
            <p className={`font-mono ${compact ? 'text-[4px]' : 'text-[7px]'}`}>No. {data.credentialNumber}</p>
            <p className={`${compact ? 'text-[4px]' : 'text-[7px]'}`}>GPA {data.gpa || '3.40'}</p>
          </div>
        </div>

        <table className={`w-full border-collapse ${chrome.tableBorder}`} style={styles.tableBorderColor ? { borderColor: styles.tableBorderColor } : undefined}>
          <thead>
            <tr className="border-b border-inherit">
              <th className={`text-left font-bold uppercase py-0.5 px-1 border-r border-inherit ${compact ? 'text-[4px]' : 'text-[7px]'}`}>Code</th>
              <th className={`text-left font-bold uppercase py-0.5 px-1 border-r border-inherit ${compact ? 'text-[4px]' : 'text-[7px]'}`}>Course</th>
              <th className={`text-center font-bold uppercase py-0.5 px-1 border-r border-inherit ${compact ? 'text-[4px]' : 'text-[7px]'}`}>Score</th>
              <th className={`text-center font-bold uppercase py-0.5 px-1 ${compact ? 'text-[4px]' : 'text-[7px]'}`}>Grade</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.code} className="border-b border-inherit">
                <td className={`font-mono py-0.5 px-1 border-r border-inherit ${compact ? 'text-[4px]' : 'text-[7px]'}`}>{c.code}</td>
                <td className={`py-0.5 px-1 border-r border-inherit uppercase ${compact ? 'text-[4px]' : 'text-[7px]'}`}>{c.name}</td>
                <td className={`text-center py-0.5 px-1 border-r border-inherit ${compact ? 'text-[4px]' : 'text-[7px]'}`}>{c.marks}</td>
                <td className={`text-center font-bold py-0.5 px-1 ${compact ? 'text-[4px]' : 'text-[7px]'}`}>{c.grade}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.footerText ? (
          <p className={`text-center text-slate-600 ${compact ? 'text-[3px]' : 'text-[6px]'}`}>{data.footerText}</p>
        ) : null}
      </div>
    </div>
  )
}

export default TranscriptCanvas
