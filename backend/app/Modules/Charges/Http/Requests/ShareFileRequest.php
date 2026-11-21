<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class ShareFileRequest extends FormRequest
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
        return ['tenant_visible' => ['required', 'boolean']];
    }

    public function visible(): bool
    {
        return $this->boolean('tenant_visible');
    }
}
