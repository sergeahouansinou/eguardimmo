<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Enums\DeclineReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class DeclineInterventionRequest extends FormRequest
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'reason' => ['required', Rule::enum(DeclineReason::class)],
            'note' => ['required', 'string', 'min:3', 'max:500'],
        ];
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }

    public function reason(): DeclineReason
    {
        return DeclineReason::from((string) $this->validated('reason'));
    }

    public function note(): string
    {
        return trim((string) $this->validated('note'));
    }
}
