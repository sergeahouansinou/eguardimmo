<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Http\Requests;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use Illuminate\Foundation\Http\FormRequest;

final class ListCustomFieldsRequest extends FormRequest
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
        return ['include_archived' => ['nullable', 'boolean']];
    }

    public function entity(): CustomFieldEntity
    {
        return CustomFieldEntity::from((string) $this->route('entity'));
    }

    public function includeArchived(): bool
    {
        return $this->boolean('include_archived');
    }
}
