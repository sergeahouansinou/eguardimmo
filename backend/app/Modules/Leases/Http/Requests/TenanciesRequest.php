<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class TenanciesRequest extends FormRequest
{
    public const MAX_PARTIES = 100;

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
            'parties' => ['required', 'array', 'min:1', 'max:'.self::MAX_PARTIES],
            'parties.*' => ['required', 'string', 'uuid'],
        ];
    }

    /**
     * @return list<string>
     */
    public function partyIds(): array
    {
        /** @var list<string> $ids */
        $ids = $this->validated('parties');

        return array_values(array_unique($ids));
    }
}
