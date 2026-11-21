<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Resources\Console;

use App\Modules\Operations\Models\BackupReport;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin BackupReport
 */
final class BackupReportResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'kind' => $this->kind->value,
            'started_at' => $this->started_at->toIso8601String(),
            'duration_seconds' => $this->duration_seconds,
            'size_bytes' => $this->size_bytes,
            'succeeded' => $this->succeeded,
            'manifest_sha256' => $this->manifest_sha256,
            'restore_test' => $this->restore_test_target === null ? null : [
                'target' => $this->restore_test_target,
                'result' => $this->restore_test_result?->value,
            ],
            'recorded_at' => $this->created_at->toIso8601String(),
        ];
    }
}
