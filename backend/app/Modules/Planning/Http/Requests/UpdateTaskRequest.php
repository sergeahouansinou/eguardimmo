<?php

declare(strict_types=1);

namespace App\Modules\Planning\Http\Requests;

use App\Modules\Planning\Data\TaskChangesData;
use App\Modules\Planning\Support\TaskRules;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;

final class UpdateTaskRequest extends FormRequest
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
        return ['lock_version' => ['required', 'integer', 'min:1'], ...TaskRules::fields(false)];
    }

    public function toData(): TaskChangesData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        $champs = Arr::except($v, ['lock_version']);

        if (isset($champs['title'])) {
            $champs['title'] = trim((string) $champs['title']);
        }

        return new TaskChangesData((int) $v['lock_version'], $champs);
    }
}
