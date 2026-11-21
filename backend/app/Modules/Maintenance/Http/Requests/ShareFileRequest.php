<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

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
        return [
            'visible_to_owner' => ['required', 'boolean'],
        ];
    }

    public function visibleToOwner(): bool
    {
        return $this->boolean('visible_to_owner');
    }
}
