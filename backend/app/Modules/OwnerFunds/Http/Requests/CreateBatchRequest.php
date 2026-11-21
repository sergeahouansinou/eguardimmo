<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class CreateBatchRequest extends FormRequest
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
            'mandant_ids' => ['nullable', 'array', 'min:1', 'max:'.(int) config('owner_funds.batch_max')],
            'mandant_ids.*' => ['uuid', 'distinct'],
        ];
    }

    /**
     * @return list<string>|null
     */
    public function mandantIds(): ?array
    {
        $ids = $this->validated('mandant_ids');

        return is_array($ids) ? array_values(array_map(strval(...), $ids)) : null;
    }
}
