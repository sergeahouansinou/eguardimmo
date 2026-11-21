<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CancelBatchRequest extends FormRequest
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
            'reason' => ['required', 'string', 'min:3', 'max:500'],
            'lock_version' => ['required', 'integer', 'min:1'],
        ];
    }

    public function reason(): string
    {
        return trim((string) $this->validated('reason'));
    }

    public function lockVersion(): int
    {
        return (int) $this->validated('lock_version');
    }
}
