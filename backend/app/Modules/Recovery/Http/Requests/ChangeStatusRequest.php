<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Requests;

use App\Modules\Recovery\Enums\CaseStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ChangeStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(CaseStatus::class)],
            'reason' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function status(): CaseStatus
    {
        return CaseStatus::from((string) $this->validated('status'));
    }

    public function reason(): ?string
    {
        return $this->filled('reason') ? trim((string) $this->validated('reason')) : null;
    }
}
