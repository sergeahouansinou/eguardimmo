<?php

declare(strict_types=1);

namespace App\Modules\Banking\Http\Requests;

use App\Modules\Banking\Enums\IgnoreReason;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class IgnoreLineRequest extends FormRequest
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
            'reason' => ['required', Rule::enum(IgnoreReason::class)],
            'pair_line_id' => ['nullable', 'uuid'],
            'lock_version' => ['required', 'integer', 'min:1'],
        ];
    }
}
