<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class PreviewPayoutsRequest extends FormRequest
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
        return ['limit' => ['nullable', 'integer', 'min:1', 'max:'.max(1, (int) config('owner_funds.batch_max'))]];
    }

    public function limit(): int
    {
        return $this->filled('limit') ? (int) $this->validated('limit') : min((int) config('owner_funds.preview_limit'), (int) config('owner_funds.batch_max'));
    }
}
