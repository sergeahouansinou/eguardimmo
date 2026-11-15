<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Requests;

use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\OrganizationKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateOrganizationRequest extends FormRequest
{
    public const PAYS = ['FR'];

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
            'kind' => ['required', Rule::enum(OrganizationKind::class)],
            'name' => ['required', 'string', 'min:2', 'max:160'],
            'country' => ['required', 'string', Rule::in(self::PAYS)],
            'first_name' => ['required', 'string', 'max:60'],
            'last_name' => ['required', 'string', 'max:60'],
        ];
    }

    public function toData(): NewOrganizationData
    {
        return new NewOrganizationData(
            OrganizationKind::from((string) $this->string('kind')),
            trim((string) $this->string('name')),
            (string) $this->string('country'),
        );
    }
}
