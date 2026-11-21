<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CompleteInterventionRequest extends FormRequest
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
            'completed_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'note' => ['required', 'string', 'min:3', 'max:1000'],
        ];
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }

    public function completedOn(): string
    {
        return (string) $this->validated('completed_on');
    }

    public function note(): string
    {
        return trim((string) $this->validated('note'));
    }
}
