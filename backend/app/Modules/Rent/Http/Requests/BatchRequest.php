<?php

declare(strict_types=1);

namespace App\Modules\Rent\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class BatchRequest extends FormRequest
{
    public const int PAR_DEFAUT = 50;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return ['limit' => ['nullable', 'integer', 'min:1', 'max:100']];
    }

    public function limit(): int
    {
        return $this->integer('limit', self::PAR_DEFAUT);
    }
}
