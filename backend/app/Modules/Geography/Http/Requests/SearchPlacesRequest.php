<?php

declare(strict_types=1);

namespace App\Modules\Geography\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class SearchPlacesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return ['q' => ['required', 'string', 'min:2', 'max:80']];
    }

    public function term(): string
    {
        return (string) $this->validated('q');
    }
}
